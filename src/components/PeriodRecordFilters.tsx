import { useMemo } from 'react';

import type { TeacherRecord } from '../shared/contracts';

interface PeriodRecordFiltersProps {
  records: TeacherRecord[];
  query: string;
  category: string;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export const filterPeriodRecords = (
  records: TeacherRecord[],
  query: string,
  category: string,
) => {
  const keyword = query.trim().toLocaleLowerCase('ko-KR');
  return records.filter((record) => {
    const categoryMatches = !category || record.categories.includes(category);
    const keywordMatches = !keyword || [record.content, ...record.categories]
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(keyword);
    return categoryMatches && keywordMatches;
  });
};

export default function PeriodRecordFilters({
  records,
  query,
  category,
  onQueryChange,
  onCategoryChange,
}: PeriodRecordFiltersProps) {
  const categories = useMemo(() => [...new Set(records.flatMap((record) => record.categories))]
    .sort((a, b) => a.localeCompare(b, 'ko-KR')), [records]);

  return (
    <div className="period-record-filters" aria-label="근거 기록 필터">
      <label>
        <span className="sr-only">기록 내용 검색</span>
        <input
          type="search"
          value={query}
          placeholder="기록 내용 검색"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <label>
        <span className="sr-only">카테고리 선택</span>
        <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="">모든 카테고리</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </div>
  );
}
