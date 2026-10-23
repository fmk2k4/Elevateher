export function DemoRibbon() {
  return (
    <div
      role="alert"
      style={{
        background: 'linear-gradient(90deg, #7C3AED, #EC4899)',
        color: '#ffffff',
        textAlign: 'center',
        padding: '6px 12px',
        fontSize: '13px',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span style={{ fontSize: '16px' }}>🚀</span>
      <span>
        <strong>Hackathon Demo Mode:</strong> Live API, Safety Scan & AI Agent active.
      </span>
    </div>
  );
}
