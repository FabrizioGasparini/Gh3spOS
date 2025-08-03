import { widgets } from '@/widgets/definitions';
import { useWidgetManager } from '@/providers/widget-manager';

export const EditWidgets = () => {
  const { addWidget } = useWidgetManager();
  return (
    <div className="p-2 bg-white/20 backdrop-blur rounded">
      <h3 className="text-white mb-2">Aggiungi widget:</h3>
      {[...widgets.entries()].map(([id, w]) => (
        <button
          key={id}
          className="block mb-1 px-2 py-1 bg-white/30 rounded hover:bg-white/50 text-white"
          onClick={() => addWidget(w, id)}
        >
          {w.name}
        </button>
      ))}
    </div>
  );
};
