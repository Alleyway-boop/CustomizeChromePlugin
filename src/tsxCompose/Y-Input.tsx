import { defineComponent } from 'vue';

interface InputProps {
    value?: string;
    onChange: (value: string) => void;
}
const Input = defineComponent({
    setup(props: InputProps) {
        const handleChange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            props.onChange(target.value);
        }
        return () => (
            <input value={props.value} onInput={handleChange} />
        )
    }
})

export default Input as typeof Input & { props: InputProps };