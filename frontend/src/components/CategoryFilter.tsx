const CATEGORY_STYLES: Record<string, string> = {
  community: 'bg-blue-100 text-blue-800 border-blue-200',
  youth: 'bg-purple-100 text-purple-800 border-purple-200',
  environment: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  charity: 'bg-pink-100 text-pink-800 border-pink-200',
  milestone: 'bg-amber-100 text-amber-800 border-amber-200',
  event: 'bg-orange-100 text-orange-800 border-orange-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export default function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          selected === null
            ? 'bg-deep-green text-white border-deep-green'
            : 'bg-white text-warm-gray border-gray-200 hover:border-gray-300'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(selected === cat ? null : cat)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors ${
            selected === cat
              ? CATEGORY_STYLES[cat] || CATEGORY_STYLES.other
              : 'bg-white text-warm-gray border-gray-200 hover:border-gray-300'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

export { CATEGORY_STYLES };
