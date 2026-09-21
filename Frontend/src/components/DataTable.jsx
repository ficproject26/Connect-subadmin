import React, { useState, useMemo } from 'react';
import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';
import { useTheme } from '../context/ThemeContext';
import { Download, Filter, RefreshCw } from 'lucide-react';

export function DataTable({
  columns,
  data = [],
  loading = false,
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
  cellClassName = ''
}) {
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Client-side search filtering
  const filteredData = useMemo(() => {
    if (!search || !search.trim()) return data;
    const q = search.trim().toLowerCase();
    const ph = (searchPlaceholder || '').trim().toLowerCase();
    // If search text matches the placeholder or starts with generic "search pincode/search records", do not filter out rows
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
    const rows = filteredData.map(item => {
      return columns.map(c => {
        const val = typeof c.accessor === 'function' ? c.accessor(item) : item[c.accessor];
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
    <div className={`admin-card overflow-hidden ${
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
            isDark
          })
        ) : (
          customHeader
        )
      ) : (
        <div className={`p-4 sm:px-5 sm:py-3.5 border-b ${
          isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'
        } flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 transition-colors`}>
          <div className="min-w-0">
            {title && (
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full sm:w-44 md:w-52 shrink"
            />

            {typeof customFilters === 'function'
              ? customFilters({ isDark })
              : customFilters}

            {filterOptions && onFilterChange && (
              <div className={`h-9 inline-flex items-center gap-2 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={activeFilter}
                  onChange={(e) => onFilterChange(e.target.value)}
                  className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 max-w-[220px] truncate font-medium`}
                >
                  {filterOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            <button
              type="button"
              onClick={handleExportCSV}
              title="Export to CSV"
              className={`h-9 inline-flex items-center gap-1.5 px-3 shrink-0 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              } border rounded-xl text-xs font-semibold transition cursor-pointer`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Export CSV</span>
            </button>

            {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}

      {/* Table Body */}
      <div className={`overflow-x-auto ${containerClassName || ''}`}>
        <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'} ${tableClassName || ''}`}>
          <thead className={`${
            isDark ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
          } uppercase tracking-wider text-[11px] border-b transition-colors`}>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`${cellClassName || 'px-3.5 sm:px-4 py-3 sm:py-3.5'} font-bold ${col.className || ''}`}>
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
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No records found</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Try adjusting your search or filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} ${onRowClick ? 'cursor-pointer' : ''} transition-colors`}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`${cellClassName || 'px-3.5 sm:px-4 py-3 sm:py-3.5'} align-middle ${col.className || ''}`}>
                      {col.render ? col.render(row) : (
                        typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
