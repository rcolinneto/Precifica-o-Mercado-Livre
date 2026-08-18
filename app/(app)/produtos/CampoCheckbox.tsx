interface CampoCheckboxProps {
  label: string;
  name: string;
  defaultChecked?: boolean;
  ajuda?: string;
}

export default function CampoCheckbox({ label, name, defaultChecked, ajuda }: CampoCheckboxProps) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
      />
      <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {ajuda && <p className="text-xs text-slate-500">{ajuda}</p>}
      </div>
    </div>
  );
}
