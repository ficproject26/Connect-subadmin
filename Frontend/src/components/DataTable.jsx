import React, { useState, useMemo, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';
import { useTheme } from '../context/ThemeContext';
import { Download, Filter, RefreshCw, LayoutGrid, Table as TableIcon, AlertCircle } from 'lucide-react';

export function DataTable({
  columns,
  data = [],
  loading = false,
  error = null,
  searchPlaceholder = 'Search records...',
  filterOptions = null,
  activeFilter = '',
  onFilterChange = null,
  customFilters = null,
  onRefresh = null,
  title = '',
  subtitle = '',
  actions = null,
  customHeader = null,
  exportFileName = 'export.csv',
  itemsPerPage = 8,
  onRowClick = null,
  tableClassName = '',
  containerClassName = '',
  cellClassName = '',
  renderCard = null,
  emptyMessage = 'No assigned records found under this territory hierarchy.'
}) {
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && renderCard) {
      return 'cards';
    }
    return 'table';
  });

  // Automatically adapt default view on resize if user hasn't explicitly toggled
  useEffect(() => {
    if (!renderCard) return;
    const handleResize = () => {
      // Don't auto-switch if user prefers table
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCard]);

  // Client-side search filtering
  const filteredData = useMemo(() => {
    if (!search || !search.trim()) return data;
    const q = search.trim().toLowerCase();
    const ph = (searchPlaceholder || '').trim().toLowerCase();
    if (q === ph || q === 'search records...' || (ph && ph.startsWith(q) && q.startsWith('search'))) {
      return data;
    }
    return data.filter(item => {
      return Object.values(item).some(val => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        if (val && typeof val === 'object') {
          return Object.values(val).some(nestedVal =>
            String(nestedVal).toLowerCase().includes(q)
          );
        }
        return false;
      });
    });
  }, [data, search, searchPlaceholder]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = columns.map(c => c.header).join(',');
    const rows = filteredData.map((item, idx) => {
      return columns.map(c => {
        let val;
        if (typeof c.accessor === 'function') {
          val = c.accessor(item, idx);
        } else if (c.accessor) {
          val = item[c.accessor];
        } else if (c.header && (c.header.toLowerCase() === 's.no' || c.header.toLowerCase() === '#' || c.header.toLowerCase() === 'sl.no')) {
          val = idx + 1;
        } else {
          val = '';
        }
        return `"${String(val || '').replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', exportFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`admin-card overflow-hidden w-full max-w-full ${
      isDark
        ? 'bg-[#131f37] border-[#1f3358] text-slate-300'
        : 'bg-white border-slate-200/90 text-slate-800 shadow-sm'
    } border rounded-2xl transition-colors`}>
      {/* Header Bar */}
      {customHeader ? (
        typeof customHeader === 'function' ? (
          customHeader({
            search,
            setSearch: (val) => {
              setSearch(val);
              setCurrentPage(1);
            },
            onRefresh,
            loading,
            handleExportCSV,
            isDark,
            viewMode,
            setViewMode
          })
        ) : (
          customHeader
        )
      ) : (
        <div className={`p-3.5 sm:p-4 lg:px-5 lg:py-4 border-b ${
          isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200/80 bg-slate-50/50'
        } flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3.5 transition-colors`}>
          {/* Title & Subtitle */}
          <div className="min-w-0 max-w-full flex-1">
            {title && (
              <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate`}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5 leading-relaxed`}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Controls Toolbar: Search, Filters, View Toggle, Export, Refresh, and Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full 2xl:w-auto 2xl:justify-end">
            {/* Search Input */}
            <SearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full sm:w-52 md:w-60 lg:w-64 shrink-0"
            />

            {/* Custom filters if provided */}
            {typeof customFilters === 'function'
              ? customFilters({ isDark })
              : customFilters}

            {/* Status Filter */}
            {filterOptions && onFilterChange && (
              <div className={`h-9 inline-flex items-center gap-1.5 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={activeFilter}
                  onChange={(e) => onFilterChange(e.target.value)}
                  className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 w-full max-w-[170px] truncate font-medium`}
                >
                  {filterOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode Switcher (if renderCard is available) */}
            {renderCard && (
              <div className={`h-9 inline-flex items-center p-0.5 rounded-xl border ${
                isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'
              } shrink-0`}>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  className={`h-7.5 px-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    viewMode === 'table'
                      ? isDark ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="Card View"
                  className={`h-7.5 px-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    viewMode === 'cards'
                      ? isDark ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Cards</span>
                </button>
              </div>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              title="Export to CSV"
              className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 shrink-0 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              } border rounded-xl text-xs font-semibold transition cursor-pointer`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Export CSV</span>
            </button>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh Data"
                className={`h-9 w-9 inline-flex items-center justify-center shrink-0 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                } border rounded-xl transition cursor-pointer`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Actions (Add Manager, etc.) */}
            {actions && (
              <div className="shrink-0 inline-flex items-center">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content: Card View OR Table View */}
      {renderCard && viewMode === 'cards' ? (
        <div className="p-3.5 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border animate-pulse ${
                  isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="h-5 bg-slate-300 dark:bg-slate-700 rounded w-1/2 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-rose-500" />
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                  >
                    Retry Loading
                  </button>
                )}
              </div>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {emptyMessage}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
              {paginatedData.map((row, idx) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + idx;
                return (
                  <div key={row.id || idx} onClick={() => onRowClick && onRowClick(row)}>
                    {renderCard({ row, index: globalIndex, isDark })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table Body with dedicated horizontal scroll container */
        <div
          className={`w-full max-w-full overflow-x-auto ${containerClassName || ''}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table className={`w-full min-w-[640px] text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'} ${tableClassName || ''}`}>
            <thead className={`${
              isDark ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
            } uppercase tracking-wider text-[11px] border-b transition-colors`}>
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`${cellClassName || 'px-3.5 sm:px-4 py-3 sm:py-3.5'} font-bold whitespace-nowrap ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'} transition-colors`}>
              {loading ? (
                Array.from({ length: 4 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    {columns.map((_, cIdx) => (
                      <td key={cIdx} className={`${cellClassName || 'px-3.5 sm:px-4 py-3 sm:py-3.5'}`}>
                        <div className={`h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded w-3/4`}></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-rose-500" />
                      <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
                      {onRefresh && (
                        <button
                          type="button"
                          onClick={onRefresh}
                          className="mt-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                        >
                          Retry Loading
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {emptyMessage}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Try adjusting search or status filters above.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIdx) => {
                  const globalIndex = (currentPage - 1) * itemsPerPage + rowIdx;
                  return (
                    <tr
                      key={row.id || rowIdx}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} ${onRowClick ? 'cursor-pointer' : ''} transition-colors`}
                    >
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} className={`${cellClassName || 'px-3.5 sm:px-4 py-3.5'} align-middle ${col.className || ''}`}>
                          {col.render ? col.render(row, globalIndex) : (
                            typeof col.accessor === 'function' ? col.accessor(row, globalIndex) : row[col.accessor]
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
        />
      )}
    </div>
  );
}
