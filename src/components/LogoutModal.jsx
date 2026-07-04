import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import Icon from './ui/Icon'

export default function LogoutModal({ onConfirm, onCancel, loggingOut = false }) {
    const { t } = useTranslation()
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center no-drag">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={!loggingOut ? onCancel : undefined}
                aria-hidden
            />

            <div
                className="relative w-80 og-panel p-6 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-modal-title">

                {loggingOut ? (
                    <div className="flex flex-col items-center py-6">
                        <div className="w-11 h-11 border-2 border-og-primary/30 border-t-og-accent rounded-full animate-spin mb-4" />
                        <p className="og-title text-sm text-og-body">{t('logoutModal.exiting')}</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center mb-5">
                            <div className="w-14 h-14 rounded-full og-error-box flex items-center justify-center">
                                <Icon icon={LogOut} size="lg" className="text-og-danger" />
                            </div>
                        </div>

                        <h3 id="logout-modal-title" className="text-center og-title text-base text-og-body mb-2">
                            {t('logoutModal.title')}
                        </h3>
                        <p className="text-center text-og-muted text-sm mb-6 leading-relaxed">
                            {t('logoutModal.description')}
                        </p>

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={onConfirm}
                                className="og-btn-danger w-full py-2.5 text-sm">
                                {t('logoutModal.confirm')}
                            </button>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="og-btn-ghost w-full py-2.5 text-sm">
                                {t('common.cancel')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
