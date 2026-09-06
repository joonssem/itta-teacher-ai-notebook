import { useEffect, useMemo, useRef, useState } from 'react';

import type { TeacherRecord } from '../shared/contracts';

interface RecordCalendarProps {
  monthKey: string;
  records: TeacherRecord[];
  onMonthChange: (monthKey: string) => void;
  onOpenRecord: (recordId: string) => void;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const toDateKey = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const currentDateKey = () => {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
};

const currentMonthKey = () => currentDateKey().slice(0, 7);

const moveMonth = (monthKey: string, amount: number) => {
  const [year, month] = monthKey.split('-').map(Number);
  const moved = new Date(year, month - 1 + amount, 1);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
};

const preview = (value: string, limit = 42) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
};

const formatSelectedDate = (dateKey: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(`${dateKey}T12:00:00`));

export default function RecordCalendar({
  monthKey,
  records,
  onMonthChange,
  onOpenRecord,
}: RecordCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const [year, month] = monthKey.split('-').map(Number);
  const today = currentDateKey();

  const recordsByDate = useMemo(() => {
    const grouped = new Map<string, TeacherRecord[]>();
    for (const record of records) {
      const current = grouped.get(record.recordDate) ?? [];
      current.push(record);
      grouped.set(record.recordDate, current);
    }
    return grouped;
  }, [records]);

  useEffect(() => {
    if (monthKey === currentMonthKey() && recordsByDate.has(today)) {
      setSelectedDate(today);
      return;
    }
    setSelectedDate([...recordsByDate.keys()].sort().at(-1) ?? (monthKey === currentMonthKey() ? today : null));
  }, [monthKey, recordsByDate, today]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const leadingBlanks = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: Array<string | null> = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(toDateKey(year, month - 1, day));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [month, year]);

  const selectedRecords = selectedDate ? recordsByDate.get(selectedDate) ?? [] : [];

  const moveSelection = (dateKey: string, amount: number) => {
    const moved = new Date(`${dateKey}T12:00:00`);
    moved.setDate(moved.getDate() + amount);
    const nextDateKey = toDateKey(moved.getFullYear(), moved.getMonth(), moved.getDate());
    if (!nextDateKey.startsWith(monthKey)) return;
    setSelectedDate(nextDateKey);
    requestAnimationFrame(() => dayButtons.current.get(nextDateKey)?.focus());
  };

  return (
    <div className="record-calendar-shell">
      <div className="record-calendar-toolbar">
        <div>
          <strong>{year}년 {month}월</strong>
          <span>날짜를 선택하면 그날의 기록을 자세히 볼 수 있습니다.</span>
        </div>
        <div>
          <button type="button" onClick={() => onMonthChange(moveMonth(monthKey, -1))} aria-label="이전 달">‹</button>
          <button type="button" onClick={() => onMonthChange(currentMonthKey())}>오늘</button>
          <button type="button" onClick={() => onMonthChange(moveMonth(monthKey, 1))} aria-label="다음 달">›</button>
        </div>
      </div>

      <div className="record-calendar-workspace">
        <div className="record-calendar" role="grid" aria-label={`${year}년 ${month}월 기록 달력`}>
          {WEEKDAYS.map((weekday) => <div className="record-calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>)}
          {cells.map((dateKey, index) => {
            if (!dateKey) return <div className="record-calendar-blank" key={`blank-${index}`} role="gridcell" />;
            const dayRecords = recordsByDate.get(dateKey) ?? [];
            return (
              <button
                ref={(element) => {
                  if (element) dayButtons.current.set(dateKey, element);
                  else dayButtons.current.delete(dateKey);
                }}
                className={`record-calendar-day ${dateKey === today ? 'today' : ''} ${dateKey === selectedDate ? 'selected' : ''} ${dayRecords.length > 0 ? 'has-records' : ''}`}
                type="button"
                role="gridcell"
                key={dateKey}
                aria-selected={dateKey === selectedDate}
                aria-label={`${Number(dateKey.slice(-2))}일, 기록 ${dayRecords.length}개`}
                onClick={() => setSelectedDate(dateKey)}
                onKeyDown={(event) => {
                  const amount = event.key === 'ArrowLeft' ? -1
                    : event.key === 'ArrowRight' ? 1
                      : event.key === 'ArrowUp' ? -7
                        : event.key === 'ArrowDown' ? 7 : 0;
                  if (!amount) return;
                  event.preventDefault();
                  moveSelection(dateKey, amount);
                }}
              >
                <span className="record-calendar-date">{Number(dateKey.slice(-2))}</span>
                {dayRecords.length > 0 && <span className="record-calendar-count">{dayRecords.length}개</span>}
                {dayRecords.slice(0, 1).map((record) => (
                  <small key={record.id}>{preview(record.content)}</small>
                ))}
                {dayRecords.length > 1 && <small className="record-calendar-more">+{dayRecords.length - 1}개 더보기</small>}
              </button>
            );
          })}
        </div>

        <section className="calendar-day-records" aria-live="polite">
          <div className="calendar-day-heading">
            <strong>{selectedDate ? formatSelectedDate(selectedDate) : `${year}년 ${month}월`}</strong>
            <span>{selectedDate ? `기록 ${selectedRecords.length}개` : '기록이 있는 날짜를 선택해 주세요.'}</span>
          </div>
          {selectedDate && selectedRecords.length === 0 && (
            <p className="calendar-day-empty">이날 저장한 기록이 없습니다.</p>
          )}
          {selectedRecords.map((record) => (
            <button className="calendar-record-card" type="button" key={record.id} onClick={() => onOpenRecord(record.id)}>
              <span>{preview(record.content, 180)}</span>
              <small>{record.categories.length > 0 ? record.categories.join(' · ') : '교실기록'} · 원문 보기 →</small>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
