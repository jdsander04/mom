import React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import styles from './CustomCalendar.module.css';

interface CustomCalendarProps {
  value: Dayjs;
  onChange: (date: Dayjs) => void;
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({ value, onChange }) => {
  const today = dayjs();
  const currentMonth = value.startOf('month');
  const startDate = currentMonth.startOf('week');
  const endDate = currentMonth.endOf('month').endOf('week');

  const weeks = [];
  let currentWeek = [];
  let currentDate = startDate;

  while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
    currentWeek.push(currentDate);
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    currentDate = currentDate.add(1, 'day');
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? value.subtract(1, 'month') 
      : value.add(1, 'month');
    onChange(newDate);
  };

  const selectDate = (date: Dayjs) => {
    onChange(date);
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button 
          className={styles.navButton} 
          onClick={() => navigateMonth('prev')}
        >
          ‹
        </button>
        <h3 className={styles.monthYear}>
          {value.format('MMMM YYYY')}
        </h3>
        <button 
          className={styles.navButton} 
          onClick={() => navigateMonth('next')}
        >
          ›
        </button>
      </div>

      <div className={styles.weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className={styles.weekday}>
            {day}
          </div>
        ))}
      </div>

      <div className={styles.weeks}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={styles.week}>
            {week.map((date) => {
              const isToday = date.isSame(today, 'day');
              const isSelected = date.isSame(value, 'day');
              const isCurrentMonth = date.isSame(currentMonth, 'month');
              
              return (
                <button
                  key={date.format('YYYY-MM-DD')}
                  className={`${styles.day} ${
                    isToday ? styles.today : ''
                  } ${
                    isSelected ? styles.selected : ''
                  } ${
                    !isCurrentMonth ? styles.otherMonth : ''
                  }`}
                  onClick={() => selectDate(date)}
                >
                  {date.format('D')}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomCalendar;