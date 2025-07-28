import { defineComponent, PropType } from 'vue';

interface InputProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    maxlength?: number;
    onFocus?: () => void;
    onBlur?: () => void;
    error?: string;
    className?: string;
}

const Input = defineComponent({
    props: {
        value: {
            type: String as PropType<string>,
            default: ''
        },
        onChange: {
            type: Function as PropType<(value: string) => void>,
            required: true
        },
        placeholder: {
            type: String as PropType<string>,
            default: '请输入内容'
        },
        disabled: {
            type: Boolean as PropType<boolean>,
            default: false
        },
        type: {
            type: String as PropType<string>,
            default: 'text'
        },
        maxlength: {
            type: Number as PropType<number>,
            default: undefined
        },
        onFocus: {
            type: Function as PropType<() => void>,
            default: () => {}
        },
        onBlur: {
            type: Function as PropType<() => void>,
            default: () => {}
        },
        error: {
            type: String as PropType<string>,
            default: ''
        },
        className: {
            type: String as PropType<string>,
            default: ''
        }
    },
    setup(props) {
        const handleChange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            props.onChange(target.value);
        };
        return () => (
            <div>
                <input
                    value={props.value}
                    onInput={handleChange}
                    placeholder={props.placeholder}
                    disabled={props.disabled}
                    type={props.type}
                    maxlength={props.maxlength}
                    onFocus={props.onFocus}
                    onBlur={props.onBlur}
                    class={props.className}
                />
                {props.error && <span class="error-message">{props.error}</span>}
            </div>
        );
    }
});

export default Input;
