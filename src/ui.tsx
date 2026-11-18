import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { num } from './engine.ts';

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`fld ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Txt({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function Area({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Numero che si può svuotare mentre si scrive: il valore passa al negozio solo se è un numero valido. */
export function Num({ value, onChange, min, max, className, ...rest }: { value: number; onChange: (v: number) => void; min?: number; max?: number; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'>) {
  const [text, setText] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(String(value));
  }, [value, focus]);
  return (
    <input
      type="number"
      inputMode="numeric"
      className={className}
      value={text}
      min={min}
      max={max}
      onFocus={() => setFocus(true)}
      onBlur={() => { setFocus(false); setText(String(value)); }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(Number(e.target.value))) onChange(num(e.target.value));
      }}
      {...rest}
    />
  );
}

/** Pulsante che chiede conferma con un secondo tocco entro 3 secondi. */
export function Confirm({ onConfirm, children, className = 'btn sm danger' }: { onConfirm: () => void; children: ReactNode; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={`${className}${armed ? ' armed' : ''}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? 'Conferma?' : children}
    </button>
  );
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastListeners = new Set<(m: string) => void>();
export function toast(msg: string): void {
  toastListeners.forEach((l) => l(msg));
  clearTimeout(toastTimer);
}
export function Toast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const l = (m: string) => {
      setMsg(m);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setMsg(''), 2600);
    };
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  return <div id="toast" className={msg ? 'on' : ''} role="status">{msg}</div>;
}
