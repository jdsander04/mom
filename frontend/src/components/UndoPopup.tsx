import { useEffect } from 'react';
import type { CartRecipe, CartItem } from '../types/cart';
import styles from './UndoPopup.module.css';

interface BulkItem extends CartItem {
  originalRecipeId: number;
}

interface UndoPopupProps {
  type: 'recipe' | 'item' | 'bulk';
  data: CartRecipe | CartItem | BulkItem[];
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoPopup({ type, data, onUndo, onDismiss }: UndoPopupProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  let message = '';
  if (type === 'recipe') {
    message = `Removed recipe: ${(data as CartRecipe).name}`;
  } else if (type === 'bulk') {
    const items = data as BulkItem[];
    message = `Removed ${items.length} ingredients`;
  } else {
    message = `Removed ingredient: ${(data as CartItem).name}`;
  }

  return (
    <div className={styles.popup}>
      <span className={styles.message}>
        {message}
      </span>
      <button onClick={onUndo} className={styles.undoBtn}>
        Undo
      </button>
      <button onClick={onDismiss} className={styles.dismissBtn}>
        ×
      </button>
    </div>
  );
}