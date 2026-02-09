import { create } from 'zustand';

interface Transform {
  id: string;
  name: string;
  category: string;
  description?: string;
  inputTypes: string[];
  outputTypes: string[];
}

interface TransformStore {
  transforms: Transform[];
  selectedCategory: string | null;
  searchQuery: string;
  
  // Actions
  setTransforms: (transforms: Transform[]) => void;
  setCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  getFilteredTransforms: () => Transform[];
}

export const useTransformStore = create<TransformStore>((set, get) => ({
  transforms: [],
  selectedCategory: null,
  searchQuery: '',
  
  setTransforms: (transforms) => set({ transforms }),
  
  setCategory: (category) => set({ selectedCategory: category }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  getFilteredTransforms: () => {
    const { transforms, selectedCategory, searchQuery } = get();
    
    let filtered = transforms;
    
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  },
}));
