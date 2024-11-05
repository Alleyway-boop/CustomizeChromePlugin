import { defineComponent, PropType } from 'vue';

interface InputProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
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
        }
    },
    setup(props) {
        const handleChange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            props.onChange(target.value);
        };
        return () => (
            <input
                value={props.value}
                onInput={handleChange}
                placeholder={props.placeholder}
                disabled={props.disabled}
            />
        );
    }
});

export default Input;
