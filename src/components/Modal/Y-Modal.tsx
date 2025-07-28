import { defineComponent, PropType, ref, computed } from 'vue';

interface ModalProps {
    visible: boolean;
    title: string;
    onOk?: () => void;
    onCancel?: () => void;
}

const Modal = defineComponent({
    props: {
        visible: {
            type: Boolean as PropType<boolean>,
            required: true
        },
        title: {
            type: String as PropType<string>,
            required: true
        },
        onOk: {
            type: Function as PropType<() => void>,
            default: () => {}
        },
        onCancel: {
            type: Function as PropType<() => void>,
            default: () => {}
        }
    },
    setup(props: ModalProps) {
        const handleOk = () => {
            props.onOk?.();
        };

        const handleCancel = () => {
            props.onCancel?.();
        };

        return () => (
            <div class="modal" style={{ display: props.visible ? 'block' : 'none' }}>
                <div class="modal-header">
                    <h2>{props.title}</h2>
                </div>
                <div class="modal-body">
                    <slot />
                </div>
                <div class="modal-footer">
                    <button onClick={handleOk}>确定</button>
                    <button onClick={handleCancel}>取消</button>
                </div>
            </div>
        );
    }
});

export default Modal;

