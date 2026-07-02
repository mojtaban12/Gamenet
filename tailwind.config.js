/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                gn: {
                    bg:       'var(--gn-bg)',
                    surface:  'var(--gn-surface)',
                    panel:    'var(--gn-panel)',
                    border:   'var(--gn-border)',
                    accent:   'var(--gn-accent)',
                    accent2:  'var(--gn-accent2)',
                    green:    'var(--gn-green)',
                    red:      'var(--gn-red)',
                    text:     'var(--gn-text)',
                    muted:    'var(--gn-muted)',
                }
            },
            fontFamily: {
                sans:    ['IRANYekanX', 'sans-serif'],
                display: ['IRANYekanX', 'sans-serif'],
                body:    ['IRANYekanX', 'sans-serif'],
                mono:    ['JetBrains Mono', 'monospace'],
            },

            animation: {
                'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow':         'glow 2s ease-in-out infinite alternate',
                'slide-up':     'slideUp 0.4s ease-out',
                'fade-in':      'fadeIn 0.3s ease-out',
                'scan':         'scan 3s linear infinite',
            },
            keyframes: {
                glow: {
                    '0%':   { boxShadow: '0 0 5px #00d4ff33' },
                    '100%': { boxShadow: '0 0 20px #00d4ff66, 0 0 40px #00d4ff22' }
                },
                slideUp: {
                    '0%':   { transform: 'translateY(16px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)',    opacity: '1' }
                },
                fadeIn: {
                    '0%':   { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                scan: {
                    '0%':   { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100vh)' }
                }
            }
        }
    },
    plugins: []
}