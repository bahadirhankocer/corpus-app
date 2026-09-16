import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from '../../ai/queue';
import { answerFollowUp, dismissFollowUp, usePendingFollowUp } from '../../db/followups';
import styles from './FollowUpFlow.module.css';

interface Props {
  onClose: () => void;
}

export function FollowUpFlow({ onClose }: Props) {
  const { t } = useTranslation();
  const followUp = usePendingFollowUp();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visible, setVisible] = useState<boolean[]>([false, false, false]);
  const [activeSection, setActiveSection] = useState(0);
  const [progress, setProgress] = useState(0);
  const [answering, setAnswering] = useState(false);

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

    function handleScroll() {
      if (!scroller) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      setProgress(max > 0 ? scroller.scrollTop / max : 0);
    }
    scroller.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', handleScroll);
    };
  }, [followUp?.id]);

  if (!followUp) return null;

  async function handleDismiss() {
    await dismissFollowUp(followUp!.id);
    onClose();
  }

  async function handleAnswer(optionIndex: number) {
    if (answering) return;
    setAnswering(true);
    await answerFollowUp(followUp!.id, optionIndex);
    void kickAiQueue();
    onClose();
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
      </div>
      <div className={styles.topBar} data-hidden={progress > 0.08}>
        <button type="button" className={styles.cancelButton} onClick={handleDismiss}>
          {t('common.cancel')}
        </button>
        <div className={styles.dots}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.progressDot} data-active={i === activeSection} />
          ))}
        </div>
      </div>

      <div className={styles.scroller} ref={scrollerRef}>
        <div
          className={styles.section}
          data-visible={visible[0]}
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
        >
          <p className={styles.originText}>{followUp.entryPreview}</p>
          <span className={styles.hint}>{t('followup.scrollHint')}</span>
        </div>

        <div
          className={styles.section}
          data-visible={visible[1]}
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
        >
          <p className={styles.question}>{followUp.question}</p>
          <span className={styles.hint}>{t('followup.scrollHint')}</span>
        </div>

        <div
          className={styles.section}
          data-visible={visible[2]}
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
        >
          <div className={styles.options}>
            {followUp.options.map((option, i) => (
              <button
                key={i}
                type="button"
                className={styles.option}
                disabled={answering}
                onClick={() => handleAnswer(i)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
