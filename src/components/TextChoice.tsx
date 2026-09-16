import { Fragment } from 'react';

import styles from './TextChoice.module.css';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  prefix?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function TextChoice<T extends string | number>({ prefix, options, value, onChange }: Props<T>) {
  return (
    <div className={styles.row}>
      {prefix && <span className={styles.prefix}>{prefix}</span>}
      <div className={styles.options}>
        {options.map((option, i) => (
          <Fragment key={option.value}>
            {i > 0 && <span className={styles.sep}>·</span>}
            <button
              type="button"
              className={styles.option}
              data-active={option.value === value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
