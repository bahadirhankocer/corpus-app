import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { INTERVIEW_ROUNDS, composeProjectProcedure, nextInterviewQuestion } from '../../ai/interview';
import type { InterviewQuestion, InterviewTurn } from '../../ai/interview';
import { db } from '../../db/db';
import { updateProject } from '../../db/projects';
import { ensureSettings } from '../../db/settings';
import styles from './ProjectInterview.module.css';

interface Props {
  projectId: string;
  onClose: () => void;
}

type Phase = 'asking' | 'composing' | 'done' | 'error';

/**
 * A short conversation that gives a project its subtext. The answers become the project's
 * manifesto and the AI's working procedure inside it.
 */
export function ProjectInterview({ projectId, onClose }: Props) {
  const { t } = useTranslation();
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [current, setCurrent] = useState<InterviewQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>('asking');
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<{ manifesto: string; procedure: string } | null>(null);
  const [name, setName] = useState('');
  const started = useRef(false);

  const ask = useCallback(
    async (history: InterviewTurn[]) => {
      setPhase('asking');
      setCurrent(null);
      setWriting(false);
      setDraft('');
      try {
        const settings = await ensureSettings();
        const project = await db.projects.get(projectId);
        if (!project || !settings.geminiApiKey) throw new Error('missing');
        setName(project.name);
        const common = {
          name: project.name,
          description: project.description,
          turns: history,
          styleGuide: settings.styleGuide,
          apiKey: settings.geminiApiKey,
          model: settings.model,
        };
        if (history.length < INTERVIEW_ROUNDS) {
          setCurrent(await nextInterviewQuestion(common));
        } else {
          setPhase('composing');
          const composed = await composeProjectProcedure(common);
          await updateProject(projectId, { manifesto: composed.manifesto.trim(), procedure: composed.procedure.trim() });
          setResult(composed);
          setPhase('done');
        }
      } catch {
        setPhase('error');
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ask([]);
  }, [ask]);

  function handleAnswer(answer: string) {
    if (!current || !answer.trim()) return;
    const next = [...turns, { question: current.question, answer: answer.trim() }];
    setTurns(next);
    void ask(next);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.top}>
        <button type="button" className={styles.textButton} onClick={onClose}>
          {phase === 'done' ? t('common.close') : t('interview.later')}
        </button>
        <span className={styles.micro}>
          {name} · {Math.min(turns.length + 1, INTERVIEW_ROUNDS)}/{INTERVIEW_ROUNDS}
        </span>
      </div>

      <div className={styles.stage} key={`${turns.length}-${phase}`}>
        {phase === 'asking' && !current && <p className={styles.muted}>{t('interview.thinking')}</p>}

        {phase === 'asking' && current && (
          <>
            <p className={styles.question}>{current.question}</p>
            <div className={styles.options}>
              {current.options.map((option) => (
                <button key={option} type="button" className={styles.option} onClick={() => handleAnswer(option)}>
                  {option}
                </button>
              ))}
            </div>
            {writing ? (
              <div className={styles.write}>
                <textarea
                  className={styles.textarea}
                  value={draft}
                  placeholder={t('question.writePlaceholder')}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                <button type="button" className={styles.send} disabled={!draft.trim()} onClick={() => handleAnswer(draft)}>
                  {t('question.send')}
                </button>
              </div>
            ) : (
              <button type="button" className={styles.textButton} onClick={() => setWriting(true)}>
                {t('question.ownWords')}
              </button>
            )}
          </>
        )}

        {phase === 'composing' && <p className={styles.muted}>{t('interview.composing')}</p>}

        {phase === 'done' && result && (
          <div className={styles.result}>
            <span className={styles.micro}>{t('atelier.manifesto')}</span>
            <p className={styles.resultText}>{result.manifesto}</p>
            <span className={styles.micro}>{t('interview.procedure')}</span>
            <p className={styles.resultText}>{result.procedure}</p>
          </div>
        )}

        {phase === 'error' && (
          <>
            <p className={styles.muted}>{t('interview.error')}</p>
            <button type="button" className={styles.textButton} onClick={() => void ask(turns)}>
              {t('detail.retry')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
