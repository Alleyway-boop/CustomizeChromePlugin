export interface TableColumn {
    prop: string;
    label: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    fixed?: 'left' | 'right';
    sortable?: boolean;
    filterable?: boolean;
    filterOptions?: TableFilterOption[];
    render?: (row: any) => JSX.Element;
    children?: TableColumn[];
}

export interface TableFilterOption {
    label: string;
    value: any;
}

export interface VirtualConfig {
    enabled: boolean;
    itemHeight: number;
    buffer: number;
}

export interface TreeProps {
    children: string;
    hasChildren: string;
}

export interface SortChangeEvent {
    prop: string;
    order: 'asc' | 'desc' | null;
}

export interface FilterChangeEvent {
    prop: string;
    values: any[];
}

export interface TableProps {
    data: any[];
    columns: TableColumn[];
    height?: string;
    border?: boolean;
    virtual?: VirtualConfig;
    rowKey?: string;
    treeProps?: TreeProps;
}

export interface TableEvents {
    onSortChange?: (evt: SortChangeEvent) => void;
    onFilterChange?: (evt: FilterChangeEvent) => void;
    onRowClick?: (row: any, index: number) => void;
    onRowExpand?: (row: any, expanded: boolean) => void;
}

export type TableInstance = {
    scrollTo: (options: { top?: number; left?: number }) => void;
    toggleRowExpansion: (row: any, expanded?: boolean) => void;
    clearSort: () => void;
    clearFilter: (columnKey?: string) => void;
    reload: () => void;
}