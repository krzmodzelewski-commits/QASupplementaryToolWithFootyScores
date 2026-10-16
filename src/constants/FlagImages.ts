export const FLAG_IMAGES = import.meta.glob<string>('../../resources/images/flags/*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
});
