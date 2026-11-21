// @react-native-community/datetimepicker on the web: the browser's date picker in a small dialog.
import React from 'react';
export default function DateTimePicker({ value, onChange, maximumDate, minimumDate }: any) {
  const iso = (d?: Date) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : undefined);
  const close = () => onChange?.({ type: 'dismissed' }, undefined);
  return React.createElement('div', { onClick: close, style: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 } },
    React.createElement('div', { onClick: (e: any) => e.stopPropagation(), style: { background: '#fff', borderRadius: 16, padding: 20, minWidth: 260, fontFamily: 'Karma-Regular, system-ui' } },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: 10 } }, 'Select date'),
      React.createElement('input', {
        type: 'date', autoFocus: true, defaultValue: iso(value), max: iso(maximumDate), min: iso(minimumDate),
        style: { fontSize: 16, padding: 8, width: '100%', boxSizing: 'border-box' },
        onChange: (e: any) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); onChange?.({ type: 'set' }, new Date(y, m - 1, d)); } },
      }),
      React.createElement('button', { onClick: close, style: { marginTop: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' } }, 'Cancel')));
}
