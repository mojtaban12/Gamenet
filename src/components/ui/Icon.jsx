const SIZES = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 48,
}

export default function Icon({
    icon: LucideIcon,
    size = 'sm',
    className = '',
    strokeWidth = 1.75,
    ...props
}) {
    const px = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.sm)

    return (
        <LucideIcon
            size={px}
            strokeWidth={strokeWidth}
            className={`shrink-0 ${className}`.trim()}
            {...props}
        />
    )
}
