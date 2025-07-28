import { defineComponent, PropType, ref, computed } from 'vue';

interface CalendarProps {
    events: Array<{ date: string; title: string }>;
    onDateClick?: (date: string) => void;
}

const Calendar = defineComponent({
    props: {
        events: {
            type: Array as PropType<Array<{ date: string; title: string }>>,
            required: true
        },
        onDateClick: {
            type: Function as PropType<(date: string) => void>,
            default: () => {}
        }
    },
    setup(props: CalendarProps) {
        const currentMonth = ref(new Date().getMonth());
        const currentYear = ref(new Date().getFullYear());

        const daysInMonth = computed(() => {
            return new Date(currentYear.value, currentMonth.value + 1, 0).getDate();
        });

        const generateCalendar = computed(() => {
            const calendar = [];
            for (let day = 1; day <= daysInMonth.value; day++) {
                const date = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const event = props.events.find(event => event.date === date);
                calendar.push({ date, event });
            }
            return calendar;
        });

        const handleDateClick = (date: string) => {
            if (props.onDateClick) {
                props.onDateClick(date);
            }
        };

        return () => (
            <div class="calendar">
                <div class="calendar-header">
                    <button onClick={() => currentMonth.value--}>Previous</button>
                    <span>{`${currentYear.value} - ${currentMonth.value + 1}`}</span>
                    <button onClick={() => currentMonth.value++}>Next</button>
                </div>
                <div class="calendar-grid">
                    {generateCalendar.value.map(({ date, event }) => (
                        <div key={date} class="calendar-day" onClick={() => handleDateClick(date)}>
                            <span>{date.split('-')[2]}</span>
                            {event ? (
                                <div class="event">
                                    <slot name="event" date={date} event={event}>
                                        {event.title} {/* 默认显示事件标题 */}
                                    </slot>
                                </div>
                            ) : (
                                <slot name="empty" date={date}>
                                    {/* 默认显示空白内容 */}
                                </slot>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
});

export default Calendar;
