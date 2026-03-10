export type ContainerType = 'BAG' | 'LARGE_TOTE' | 'SMALL_TOTE' | 'DUFFEL' | 'PENCIL_BOX';

export const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BAG: 'Bag',
  LARGE_TOTE: 'Large Tote',
  SMALL_TOTE: 'Small Tote',
  DUFFEL: 'Duffel',
  PENCIL_BOX: 'Pencil Box',
};

export const CONTAINER_OPTIONS: { value: ContainerType; label: string }[] =
  Object.entries(CONTAINER_TYPE_LABELS).map(([value, label]) => ({
    value: value as ContainerType,
    label,
  }));
