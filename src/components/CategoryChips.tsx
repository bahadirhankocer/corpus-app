import { useTranslation } from 'react-i18next';

import { ALL_CATEGORIES, CATEGORY_CODES } from '../constants/categories';
import type { Category } from '../db/types';
import styles from './CategoryChips.module.css';

interface Props {
  value: Category[];
  onChange: (value: Category[]) => void;
}

export function CategoryChips({ value, onChange }: Props) {
  const { t } = useTranslation();

  function toggle(category: Category) {
    if (value.includes(category)) {
      onChange(value.filter((c) => c !== category));
    } else {
      onChange([...value, category]);
    }
  }

  return (
    <div className={styles.chips}>
      {ALL_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={styles.chip}
          data-active={value.includes(category)}
          onClick={() => toggle(category)}
          title={t(`category.${category}`)}
        >
          {CATEGORY_CODES[category]}
        </button>
      ))}
    </div>
  );
}
