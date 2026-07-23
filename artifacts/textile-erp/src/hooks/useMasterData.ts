import { useState, useCallback } from "react";

interface UseMasterDataOptions {
  pageSize?: number;
}

export function useMasterData(options?: UseMasterDataOptions) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(options?.pageSize || 15);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'idle' | 'add' | 'edit'>('idle');

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