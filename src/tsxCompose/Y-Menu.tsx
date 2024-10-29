import { defineComponent, PropType, ref } from "vue";
import './global.css';
interface MenuItem {
    id: number;
    label: string;
    link?: string;
    children?: MenuItem[];
}

const MenuItemComponent = defineComponent({
    props: {
        item: {
            type: Object as PropType<MenuItem>,
            required: true
        }
    },
    setup(props) {
        const isHovered = ref(false);

        return () => (
            <li
                class="menu-item"
                onMouseenter={() => isHovered.value = true}
                onMouseleave={() => isHovered.value = false}
            >
                {props.item.link ? (
                    <a href={props.item.link}>{props.item.label}</a>
                ) : (
                    <span>{props.item.label}</span>
                )}
                {props.item.children && props.item.children.length > 0 && (
                    <ul class={`submenu ${isHovered.value ? 'active' : ''}`}>
                        {props.item.children.map(child => (
                            <MenuItemComponent key={child.id} item={child} />
                        ))}
                    </ul>
                )}
            </li>
        );
    }
});

export default defineComponent({
    props: {
        items: {
            type: Array as PropType<MenuItem[]>,
            required: true
        }
    },
    setup(props) {
        return () => (
            <nav class="y-menu">
                <ul class="menu">
                    {props.items.map(item => (
                        <MenuItemComponent key={item.id} item={item} />
                    ))}
                </ul>
            </nav>
        );
    },
});
