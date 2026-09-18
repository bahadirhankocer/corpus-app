import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from '../../ai/queue';
import { answerQuestion, dismissQuestion, useQuestions } from '../../db/questions';
import styles from './QuestionFlow.module.css';

interface Props {
  onClose: () => void;
}

/**
 * One question at a time, revealed by scrolling: where it came from, the question itself,
 * then three ways to go (or your own words). Follow-ups on entries and the AI's own
 * proactive questions share this flow.
 */
export function QuestionFlow({ onClose }: Props) {
  const { t } = useTranslation();
  const questions = useQuestions();
  const question = questions?.[0];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visible, setVisible] = useState<boolean[]>([false, false, false]);
  const [activeSection, setActiveSection] = useState(0);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
          if (index === -1) return;
          if (entry.isIntersecting) {
            setVisible((prev) => {
              if (prev[index]) return prev;
              const next = [...prev];
              next[index] = true;
              return next;
            });
          }
          if (entry.intersectionRatio > 0.6) setActiveSection(index);
        });
      },
      { root: scroller, threshold: [0, 0.6] },
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));

    let frame = 0;
    function handleScroll() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!scroller) return;
        const max = scroller.scrollHeight - scroller.clientHeight;
        setProgress(max > 0 ? scroller.scrollTop / max : 0);
      });
    }
    scroller.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [question?.key]);

  useEffect(() => {
    if (questions && questions.length === 0) onClose();
  }, [questions, onClose]);

  if (!question) return null;
  const current = question;

  async function handleDismiss() {
    await dismissQuestion(current);
    onClose();
  }

  async function handleAnswer(optionIndex: number | null, freeText?: string) {
    if (busy) return;
    setBusy(true);
    await answerQuestion(current, optionIndex, freeText);
    void kickAiQueue();
    onClose();
  }

  const setRef = (i: number) => (el: HTMLDivElement | null) => {
    sectionRefs.current[i] = el;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className={styles.topBar} data-hidden={progress > 0.08}>
        <button type="button" className={styles.cancelButton} onClick={handleDismiss}>
          {t('question.skip')}
        </button>
        <div className={styles.dots}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.progressDot} data-active={i === activeSection} />
          ))}
        </div>
      </div>

      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.section} data-visible={visible[0]} ref={setRef(0)}>
          <span className={styles.kicker}>{t(`question.kind.${current.kicker}`)}</span>
          <p className={styles.originText}>{current.origin}</p>
          <span className={styles.hint}>{t('question.scrollHint')}</span>
        </div>

        <div className={styles.section} data-visible={visible[1]} ref={setRef(1)}>
          <p className={styles.question}>{current.question}</p>
          <span className={styles.hint}>{t('question.scrollHint')}</span>
        </div>

        <div className={styles.section} data-visible={visible[2]} ref={setRef(2)}>
          <div className={styles.options}>
            {current.options.map((option, i) => (
              <button key={i} type="button" className={styles.option} disabled={busy} onClick={() => handleAnswer(i)}>
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
              <button
                type="button"
                className={styles.send}
                disabled={busy || draft.trim().length === 0}
                onClick={() => handleAnswer(null, draft.trim())}
              >
                {t('question.send')}
              </button>
            </div>
          ) : (
            <button type="button" className={styles.ownWords} onClick={() => setWriting(true)}>
              {t('question.ownWords')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
