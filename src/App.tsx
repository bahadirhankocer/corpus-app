import { useTranslation } from 'react-i18next';

function App() {
  const { t, i18n } = useTranslation();

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-5)',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.08em',
        }}
      >
        {i18n.language.toUpperCase()}
      </span>
      <h1 style={{ fontWeight: 500, fontSize: 22, margin: 0 }}>{t('app.name')}</h1>
    </main>
  );
}

export default App;
