import { defineComponent, ref, PropType, computed, onMounted, nextTick } from "vue";

// 扩展列接口
interface TableColumn {
    prop: string;
    label: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    fixed?: 'left' | 'right';
    sortable?: boolean;
    filterable?: boolean;
    filterOptions?: { label: string; value: any }[];
    render?: (row: any) => JSX.Element; // 自定义渲染函数
    children?: TableColumn[]; // 用于表头合并
}

// 虚拟滚动配置
interface VirtualConfig {
    enabled: boolean;
    itemHeight: number;
    buffer: number;
}

export default defineComponent({
    name: 'YTable',
    props: {
        data: {
            type: Array as PropType<any[]>,
            required: true,
            default: () => []
        },
        columns: {
            type: Array as PropType<TableColumn[]>,
            required: true,
            default: () => []
        },
        height: {
            type: String,
            default: 'auto'
        },
        border: {
            type: Boolean,
            default: false
        },
        virtual: {
            type: Object as PropType<VirtualConfig>,
            default: () => ({
                enabled: false,
                itemHeight: 40,
                buffer: 10
            })
        },
        rowKey: {
            type: String,
            default: 'id'
        },
        treeProps: {
            type: Object as PropType<{
                children: string;
                hasChildren: string;
            }>,
            default: () => ({
                children: 'children',
                hasChildren: 'hasChildren'
            })
        }
    },

    setup(props, { emit }) {
        const tableWrapper = ref<HTMLElement | null>(null);
        const scrollTop = ref(0);
        const expandedRows = ref<Set<string>>(new Set());
        const sortState = ref<{ prop: string; order: 'asc' | 'desc' | null }>({ prop: '', order: null });
        const filterStates = ref<Record<string, any[]>>({});

        // 虚拟滚动相关计算
        const visibleRange = computed(() => {
            if (!props.virtual.enabled) return { start: 0, end: props.data.length };

            const start = Math.floor(scrollTop.value / props.virtual.itemHeight);
            const visibleCount = Math.ceil(parseInt(props.height) / props.virtual.itemHeight);
            const bufferedStart = Math.max(0, start - props.virtual.buffer);
            const bufferedEnd = Math.min(props.data.length, start + visibleCount + props.virtual.buffer);

            return { start: bufferedStart, end: bufferedEnd };
        });

        // 处理排序和筛选后的数据
        const processedData = computed(() => {
            let result = [...props.data];

            // 应用筛选
            Object.entries(filterStates.value).forEach(([prop, values]) => {
                if (values && values.length) {
                    result = result.filter(row => values.includes(row[prop]));
                }
            });

            // 应用排序
            if (sortState.value.prop && sortState.value.order) {
                result.sort((a, b) => {
                    const factor = sortState.value.order === 'asc' ? 1 : -1;
                    return (a[sortState.value.prop] - b[sortState.value.prop]) * factor;
                });
            }

            return result;
        });

        // 展开/收起行
        const toggleRowExpansion = (row: any) => {
            const key = row[props.rowKey];
            if (expandedRows.value.has(key)) {
                expandedRows.value.delete(key);
            } else {
                expandedRows.value.add(key);
            }
        };

        // 渲染表头
        const renderHeader = () => {
            const renderHeaderCell = (column: TableColumn) => {
                return (
                    <div
                        class={[
                            'y-table__cell',
                            'y-table__header-cell',
                            column.fixed ? `is-fixed-${column.fixed}` : '',
                            { 'is-sortable': column.sortable }
                        ]}
                        style={{
                            width: column.width || '100px',
                            textAlign: column.align || 'left'
                        }}
                    >
                        <div class="y-table__header-cell-content">
                            <span>{column.label}</span>
                            {column.sortable && (
                                <div class="y-table__sort-icons" onClick={() => handleSort(column.prop)}>
                                    {/* 添加排序图标 */}
                                </div>
                            )}
                            {column.filterable && (
                                <div class="y-table__filter" onClick={() => handleFilter(column)}>
                                    {/* 添加筛选图标和下拉菜单 */}
                                </div>
                            )}
                        </div>
                    </div>
                );
            };

            return (
                <div class="y-table__header">
                    <div class="y-table__header-row">
                        {props.columns.map(column => renderHeaderCell(column))}
                    </div>
                </div>
            );
        };

        // 渲染表格主体
        const renderBody = () => {
            const renderCell = (row: any, column: TableColumn) => {
                if (column.render) {
                    return column.render(row);
                }
                return row[column.prop];
            };

            const renderRow = (row: any, rowIndex: number, level = 0) => {
                const key = row[props.rowKey];
                const hasChildren = row[props.treeProps.hasChildren];
                const children = row[props.treeProps.children];

                return (
                    <>
                        <div
                            class="y-table__body-row"
                            key={key}
                            style={{
                                transform: `translateY(${rowIndex * props.virtual.itemHeight}px)`,
                                height: `${props.virtual.itemHeight}px`
                            }}
                        >
                            {props.columns.map(column => (
                                <div
                                    class={[
                                        'y-table__cell',
                                        'y-table__body-cell',
                                        column.fixed ? `is-fixed-${column.fixed}` : ''
                                    ]}
                                    style={{
                                        width: column.width || '100px',
                                        textAlign: column.align || 'left',
                                        paddingLeft: level ? `${level * 20}px` : undefined
                                    }}
                                >
                                    {column.prop === props.columns[0].prop && hasChildren && (
                                        <span
                                            class="y-table__expand-icon"
                                            onClick={() => toggleRowExpansion(row)}
                                        >
                                            {expandedRows.value.has(key) ? '-' : '+'}
                                        </span>
                                    )}
                                    {renderCell(row, column)}
                                </div>
                            ))}
                        </div>
                        {expandedRows.value.has(key) && children?.map((child: any, index: number) =>
                            renderRow(child, rowIndex + index + 1, level + 1)
                        )}
                    </>
                );
            };

            const visibleData = processedData.value.slice(visibleRange.value.start, visibleRange.value.end);

            return (
                <div
                    class="y-table__body"
                    onScroll={(e) => scrollTop.value = (e.target as HTMLElement).scrollTop}
                >
                    <div style={{ height: `${processedData.value.length * props.virtual.itemHeight}px` }}>
                        {visibleData.map((row, index) => renderRow(row, index))}
                    </div>
                </div>
            );
        };

        // 处理排序
        const handleSort = (prop: string) => {
            if (sortState.value.prop === prop) {
                sortState.value.order = sortState.value.order === 'asc' ? 'desc' :
                    sortState.value.order === 'desc' ? null : 'asc';
            } else {
                sortState.value = { prop, order: 'asc' };
            }
            emit('sort-change', sortState.value);
        };

        // 处理筛选
        const handleFilter = (column: TableColumn) => {
            // 实现筛选逻辑
        };

        return () => (
            <div
                ref={tableWrapper}
                class={['y-table', { 'y-table--border': props.border }]}
                style={{ height: props.height }}
            >
                {renderHeader()}
                {renderBody()}
            </div>
        );
    }
});
