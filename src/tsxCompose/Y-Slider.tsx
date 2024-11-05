import { defineComponent, ref, PropType } from 'vue';

interface YSliderProps {
    min: number;
    max: number;
    step?: number;
    vertical?: boolean;
    inverted?: boolean;
    marks?: number[];
    range?: boolean;
    customLabel?: (value: number) => string;
}

export default defineComponent({
    name: 'YSlider',
    props: {
        min: {
            type: Number,
            required: true,
        },
        max: {
            type: Number,
            required: true,
        },
        step: {
            type: Number,
            default: 1,
        },
        vertical: {
            type: Boolean,
            default: false,
        },
        inverted: {
            type: Boolean,
            default: false,
        },
        marks: {
            type: Array as PropType<number[]>,
            default: () => [],
        },
        range: {
            type: Boolean,
            default: false,
        },
        customLabel: {
            type: Function as PropType<(value: number) => string>,
            default: (value: number) => value.toString(),
        },
    },
    setup(props, { emit, slots }) {
        const value = ref(props.min);

        const handleChange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            value.value = Number(target.value);
            emit('input', value.value);
            emit('change', value.value);
        };

        const sliderStyle = {
            display: props.vertical ? 'block' : 'inline-block',
            transform: props.inverted ? 'rotate(180deg)' : 'none',
        };

        return () => (
            <div style={sliderStyle}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {slots.prefix && <span class="prefix-icon">{slots.prefix()}</span>}
                    <input
                        type="range"
                        min={props.min}
                        max={props.max}
                        step={props.step}
                        value={value.value}
                        onInput={handleChange}
                        style={{ writingMode: props.vertical ? 'bt-lr' : 'horizontal-tb' } as any}
                    />
                    {slots.suffix && <span class="suffix-icon">{slots.suffix()}</span>}
                </div>
                <div>
                    {slots.label ? slots.label({ value: value.value }) : props.customLabel(value.value)}
                </div>
                {props.marks.length > 0 && (
                    <div>
                        {props.marks.map((mark) => (
                            <span key={mark}>{mark}</span>
                        ))}
                    </div>
                )}
            </div>
        );
    },
});