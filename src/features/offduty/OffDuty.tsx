import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { formatMoney, tripEarnings } from '../../core/context/pay';
import { timeAwayMinutes, tripFlightMinutes } from '../../core/context/trip';
import { formatDuration, formatHoursDecimal } from '../../core/time/time';
import type { ExpenseCategory } from '../../core/types';
import { addExpense, deleteExpense } from '../../store/actions';
import { primaryTrip } from '../../core/context/schedule';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Field, Panel, Stat, Stats } from '../../ui/primitives';

const CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'supplies', label: 'Supplies' },
  { id: 'other', label: 'Other' },
];

export function OffDuty() {
  const state = useCrew();
  const now = useNow();
  const trip = primaryTrip(state.trips, now);
  const earnings = trip ? tripEarnings(trip, state.pilot.pay) : null;

  const thisMonth = now.toISOString().slice(0, 7);
  const monthExpenses = state.expenses.filter((e) => e.date.startsWith(thisMonth));
  const monthSpend = monthExpenses.reduce((n, e) => n + e.amount, 0);

  return (
    <>
      <TopBar title="Pay & Expenses" back action={<Link className="chip" to="/settings">⚙</Link>} />
      <Screen>
        <Panel title="This trip">
          {trip && earnings ? (
            <>
              <Stats>
                <Stat k="Flight" v={formatHoursDecimal(tripFlightMinutes(trip))} sub="hours" />
                <Stat k="Away" v={formatDuration(timeAwayMinutes(trip))} sub="TAFB" />
                <Stat k="Pay" v={formatMoney(earnings.flightPay, earnings.currency)} sub={basisLabel(earnings.basis)} />
                <Stat k="Per diem" v={formatMoney(earnings.perDiem, earnings.currency)} />
              </Stats>
              {earnings.total !== null && (
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow" style={{ margin: 0 }}>
                    Effective hourly, gate to gate
                  </div>
                  <div className="big accent-text">{formatMoney(earnings.effectiveHourly, earnings.currency)}</div>
                  <div className="tiny faint">
                    {formatMoney(earnings.total, earnings.currency)} total ÷ {formatHoursDecimal(earnings.timeAwayMinutes)} h
                    away from base
                  </div>
                </div>
              )}
              {earnings.missing.length > 0 && (
                <div className="banner" style={{ marginTop: 12, marginBottom: 0 }}>
                  <span className="grow">
                    Set your {earnings.missing.join(' and ')} in Settings and these numbers fill in. CREW ships no rate
                    tables — the figures are yours.
                  </span>
                  <Link to="/settings">Set</Link>
                </div>
              )}
            </>
          ) : (
            <div className="small faint">No trip loaded.</div>
          )}
          <Advisory>
            Nothing here reflects a contract. CREW multiplies the hours in your trip by the rates you typed in — check
            it against your actual pay register.
          </Advisory>
        </Panel>

        <div className="tiny faint" style={{ textAlign: 'center', margin: '0 0 12px' }}>
          Flight hours, distance and monthly totals live in <Link to="/logbook">Logbook</Link>.
        </div>

        <ExpenseBlock monthSpend={monthSpend} thisMonth={thisMonth} />
      </Screen>
    </>
  );
}

function basisLabel(basis: ReturnType<typeof tripEarnings>['basis']): string {
  switch (basis) {
    case 'published-credit':
      return 'published credit';
    case 'block-time':
      return 'block time';
    default:
      return 'no basis';
  }
}

function ExpenseBlock({ monthSpend, thisMonth }: { monthSpend: number; thisMonth: string }) {
  const state = useCrew();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [place, setPlace] = useState('');
  const [reimbursable, setReimbursable] = useState(false);

  const submit = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    addExpense({
      date: new Date().toISOString().slice(0, 10),
      amount: value,
      currency: state.pilot.pay.currency,
      category,
      place: place || undefined,
      reimbursable,
    });
    setAmount('');
    setPlace('');
    setOpen(false);
  };

  const recent = state.expenses.slice(0, 12);

  return (
    <Panel
      title="Expenses"
      action={
        <button type="button" className="action" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Add'}
        </button>
      }
    >
      <Stats>
        <Stat k={`${thisMonth} spend`} v={formatMoney(monthSpend, state.pilot.pay.currency)} />
        <Stat k="Entries" v={state.expenses.length} />
        <Stat
          k="Reimbursable"
          v={formatMoney(
            state.expenses.filter((e) => e.reimbursable).reduce((n, e) => n + e.amount, 0),
            state.pilot.pay.currency,
          )}
        />
      </Stats>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div className="inline-fields">
            <Field label="Amount">
              <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Where">
            <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Optimist Hall" />
          </Field>
          <label className="toggle-row">
            <span className="small">Reimbursable</span>
            <button
              type="button"
              className={`switch ${reimbursable ? 'on' : ''}`}
              aria-pressed={reimbursable}
              onClick={() => setReimbursable((v) => !v)}
            />
          </label>
          <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={submit}>
            Save expense
          </button>
        </div>
      )}

      {recent.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          {recent.map((e) => (
            <div key={e.id} className="row">
              <span className="mono small faint" style={{ width: 74, flex: 'none' }}>
                {e.date.slice(5)}
              </span>
              <div className="grow small">
                <span>{e.place || CATEGORIES.find((c) => c.id === e.category)?.label}</span>
                {e.reimbursable && <span className="chip go" style={{ marginLeft: 6, padding: '1px 6px' }}>R</span>}
              </div>
              <span className="mono strong">{formatMoney(e.amount, e.currency)}</span>
              <button
                type="button"
                className="chev"
                style={{ background: 'none', border: 0 }}
                onClick={() => deleteExpense(e.id)}
                aria-label="Delete expense"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        !open && <Empty glyph="▤" title="Nothing logged yet">Tap Add after your next coffee.</Empty>
      )}
    </Panel>
  );
}
