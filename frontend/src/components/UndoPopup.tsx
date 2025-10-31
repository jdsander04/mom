import { useEffect } from 'react';
import type { CartRecipe, CartItem } from '../types/cart';
import styles from './UndoPopup.module.css';

interface UndoPopupProps {
  type: 'recipe' | 'item';
  data: CartRecipe | CartItem;
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

  const itemName = type === 'recipe' ? (data as CartRecipe).name : (data as CartItem).name;

  return (
    <div className={styles.popup}>
      <span className={styles.message}>
        Removed {type === 'recipe' ? 'recipe' : 'ingredient'}: {itemName}
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