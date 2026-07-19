"use client";

type ConfirmDeleteDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <div className="iis-modal-backdrop" role="dialog" aria-modal="true">
      <div className="iis-modal iis-confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="iis-modal-actions">
          <button
            className="iis-button iis-button-ghost"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="iis-button iis-button-danger-solid"
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
