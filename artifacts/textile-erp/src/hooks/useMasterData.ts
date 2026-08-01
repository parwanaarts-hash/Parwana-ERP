import { useState, useCallback } from "react";

interface UseMasterDataOptions {
  pageSize?: number;
  /** Starting mode. Defaults to 'add' so every form opens ready for entry. */
  initialMode?: 'idle' | 'add' | 'edit';
}

export function useMasterData(options?: UseMasterDataOptions) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(options?.pageSize || 15);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'idle' | 'add' | 'edit'>(options?.initialMode ?? 'add');

  const startAdd = useCallback(() => {
    setMode('add');
    setSelectedId(null);
  }, []);

  const startEdit = useCallback((id: number) => {
    setMode('edit');
    setSelectedId(id);
  }, []);

  const exitForm = useCallback(() => {
    setMode('idle');
    setSelectedId(null);
  }, []);

  return {
    search, setSearch,
    page, setPage,
    pageSize, setPageSize,
    selectedId, setSelectedId,
    mode, setMode,
    startAdd, startEdit, exitForm
  };
}
