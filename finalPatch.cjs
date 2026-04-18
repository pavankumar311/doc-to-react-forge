const fs = require('fs');

const path = 'src/components/CrimesSection.jsx';
const text = fs.readFileSync(path, 'utf8');
const newReturnBlock = `return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Top Tabs */}
      <div className="flex items-center gap-2">
        {["Map Area Crime", "Crime Dashboard"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={\`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all \${activeTab === t
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "bg-white text-slate-400 border border-slate-200 hover:border-blue-400"
              }\`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <LoadingOverlay />}

      {activeTab === "Map Area Crime" ? (
        <>
          {/* Map Area Crime Top Headers */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Crimes", val: kpis?.total, color: "text-blue-900", bg: "bg-white" },
              { label: "Violent Crimes", val: kpis?.violent, color: "text-red-500", bg: "bg-white" },
              { label: "Property Crimes", val: kpis?.property, color: "text-amber-500", bg: "bg-white" },
              { label: "Other Crimes", val: kpis?.other, color: "text-slate-800", bg: "bg-white" }
            ].map((k, i) => (
              <div key={i} className={\`\${k.bg} border border-slate-200 p-6 rounded-2xl shadow-sm text-center flex flex-col justify-center min-h-[140px]\`}>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{k.label}</div>
                <div className={\`text-3xl font-black \${k.color}\`}>{k.val?.toLocaleString() || 0}</div>
                <div className="text-[7px] text-slate-300 font-black uppercase mt-2 tracking-tighter">Active Forensic View</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-6 min-h-[600px] relative">
            <div className="col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5 overflow-y-auto">
              <div>
                <div className="flex flex-col items-center gap-1 mb-5">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Forensic Filters</span>
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">Live CPD Data</span>
                </div>

                <div className="space-y-2">
                  <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Date Range</div>
                  {["Last 30 Days", "Last 90 Days"].map(d => (
                    <label key={d} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setFilters({ ...filters, dateRange: d, customFrom: "", customTo: "" })}
                        className={\`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all \${filters.dateRange === d ? 'border-blue-500' : 'border-slate-200 group-hover:border-blue-300'}\`}
                      >
                        {filters.dateRange === d && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                      <span className={\`text-[10px] font-black uppercase \${filters.dateRange === d ? 'text-slate-800' : 'text-slate-400'}\`}>{d}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setFilters({ ...filters, dateRange: "Custom" })}
                      className={\`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all \${filters.dateRange === "Custom" ? 'border-blue-500' : 'border-slate-200 group-hover:border-blue-300'}\`}
                    >
                      {filters.dateRange === "Custom" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className={\`text-[10px] font-black uppercase \${filters.dateRange === "Custom" ? 'text-slate-800' : 'text-slate-400'}\`}>Custom Range</span>
                  </label>
                  {filters.dateRange === "Custom" && (
                    <div className="ml-7 space-y-2 pt-1">
                      <div>
                        <div className="text-[8px] font-black text-slate-300 uppercase mb-1">From</div>
                        <input type="date" value={filters.customFrom}
                          onChange={e => setFilters({ ...filters, customFrom: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-bold text-slate-600 px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-slate-300 uppercase mb-1">To</div>
                        <input type="date" value={filters.customTo}
                          onChange={e => setFilters({ ...filters, customTo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-bold text-slate-600 px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-50" />
              <div className="h-px bg-slate-50" />

              <div className="space-y-4">
                {Object.entries(filters.crimeToggles).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className={\`text-[10px] font-black uppercase \${v ? 'text-slate-800' : 'text-slate-400'}\`}>{k} crime</span>
                    <div
                      onClick={() => setFilters({ ...filters, crimeToggles: { ...filters.crimeToggles, [k]: !v } })}
                      className={\`w-10 h-5 rounded-full relative transition-all cursor-pointer \${v ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}\`}
                    >
                      <div className={\`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm \${v ? 'left-6' : 'left-1'}\`} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-slate-50" />

              <div className="space-y-3">
                <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">Map Overlays</div>
                {Object.entries(filters.layers).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-3 cursor-pointer group">
                    <div className={\`w-4 h-4 rounded border-2 flex items-center justify-center transition-all \${v ? 'bg-blue-600 border-blue-600' : 'border-slate-200 group-hover:border-blue-300'}\`}>
                      {v && <div className="text-white text-[8px] font-black">✓</div>}
                    </div>
                    <input type="checkbox" className="hidden" checked={v} onChange={() => setFilters({ ...filters, layers: { ...filters.layers, [k]: !v } })} />
                    <span className={\`text-[10px] font-black uppercase \${v ? 'text-slate-800' : 'text-slate-400'}\`}>{k} boundaries</span>
                  </label>
                ))}
              </div>

              <div className="h-px bg-slate-50" />

              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Navigation size={9} className="text-red-400" />
                  <div className="text-[8px] font-black text-red-400 uppercase tracking-widest">Find Crime Near</div>
                </div>

                <div className="flex items-stretch gap-0 relative">
                  <div className="relative group">
                    <button className="h-full px-2 bg-white border border-slate-200 border-r-0 rounded-l-lg flex items-center gap-1 hover:bg-slate-50 transition-colors">
                      <ChevronDown size={12} className="text-slate-400" />
                      <Filter size={10} className="text-slate-600" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-[180px] bg-white border border-slate-200 rounded-lg shadow-xl z-[3000] hidden group-hover:block p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                       {['all', 'districts', 'beats', 'wards'].map(cat => (
                        <label key={cat} className="flex items-center gap-3 cursor-pointer group/item">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-400 cursor-pointer border-slate-300"
                            checked={findNear.searchFilters[cat]}
                            onChange={(e) => {
                              const val = e.target.checked;
                              if (cat === 'all') {
                                setFindNear(p => ({ ...p, searchFilters: { all: val, districts: val, beats: val, wards: val } }));
                              } else {
                                setFindNear(p => ({ ...p, searchFilters: { ...p.searchFilters, [cat]: val, all: false } }));
                              }
                            }}
                          />
                          <span className="text-[10px] font-bold text-slate-600 uppercase group-hover/item:text-blue-600 transition-colors capitalize">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={findNear.address}
                      onChange={e => setFindNear(p => ({ ...p, address: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleFindNear()}
                      placeholder="Find address or place"
                      className="w-full bg-white border border-slate-200 rounded-r-lg text-[10px] font-bold text-slate-600 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-300 pr-10"
                    />
                    <button onClick={handleFindNear} className="absolute right-2 top-2.5 p-1 text-slate-400 hover:text-blue-600 transition-colors">
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                {findNear.searchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-[180px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {findNear.searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => selectSearchResult(res)}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <div className="text-[9px] font-black text-slate-700 uppercase">{res.name}</div>
                        <div className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">{res.type} context</div>
                      </div>
                    ))}
                  </div>
                )}

                {findNear.selectedResult && (
                  <div className="p-3 border border-red-100 bg-red-50/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] font-black text-red-500 uppercase">{findNear.selectedResult.name}</div>
                      <button onClick={() => setFindNear(p => ({ ...p, selectedResult: null, active: false, lat: null, lng: null, address: "", searchResults: [] }))} className="text-slate-400 hover:text-red-500 transition-colors">✕</button>
                    </div>

                    {findNear.selectedResult.type === 'address' && (
                      <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Search Buffer</div>
                        <select
                          value={findNear.radius}
                          onChange={e => setFindNear(p => ({ ...p, radius: Number(e.target.value) }))}
                          className="w-full bg-white border border-slate-100 rounded-lg text-[9px] font-bold text-slate-600 px-2 py-1.5 outline-none focus:ring-2 focus:ring-red-300"
                        >
                          {[250, 500, 1000, 1500, 2000].map(r => <option key={r} value={r}>{r}m Buffer</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden relative shadow-sm h-[600px]">
              <MapContainer center={[41.8781, -87.6298]} zoom={11} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <ZoomTracker setZoom={setZoom} />
                <MapAutoScaler incidents={incidents} />

                {(!findNear.selectedResult || findNear.selectedResult.type === 'address') && (
                  <>
                    {filters.layers.district && boundaries.district && <GeoJSON data={boundaries.district} style={{ color: "black", weight: 2.5, opacity: 0.8, fillColor: "transparent" }} />}
                    {filters.layers.beat && boundaries.beat && <GeoJSON data={boundaries.beat} style={{ color: "#0ea5e9", weight: 1.2, opacity: 0.5, dashArray: "5, 10", fillColor: "transparent" }} />}
                    {filters.layers.ward && boundaries.ward && <GeoJSON data={boundaries.ward} style={{ color: "#7dd3fc", weight: 1.0, opacity: 0.4, fillColor: "transparent" }} />}
                  </>
                )}

                {findNear.selectedResult && findNear.selectedResult.type !== 'address' && (
                  <>
                    <GeoJSON
                      key={findNear.selectedResult.id}
                      data={findNear.selectedResult.geometry}
                      style={{ color: "#ef4444", weight: 4, opacity: 1, fillColor: "#ef4444", fillOpacity: 0.05 }}
                    />
                    <FindNearFlyTo lat={findNear.lat} lng={findNear.lng} />
                  </>
                )}

                {findNear.active && findNear.lat && findNear.selectedResult?.type === 'address' && (
                  <>
                    <Circle
                      center={[findNear.lat, findNear.lng]}
                      radius={findNear.radius}
                      pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
                    />
                    <Marker position={[findNear.lat, findNear.lng]} icon={L.divIcon({ className: '', html: \`<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 0 8px #ef4444"></div>\`, iconSize: [12, 12], iconAnchor: [6, 6] })} />
                    <FindNearFlyTo lat={findNear.lat} lng={findNear.lng} />
                  </>
                )}

                {(findNear.active && findNear.lat && findNear.selectedResult?.type === 'address' ? spatialClusters.filter(c => {
                  const d = L.latLng(c.lat, c.lng).distanceTo(L.latLng(findNear.lat, findNear.lng));
                  return d <= findNear.radius;
                }) : spatialClusters).map((c, idx) => (
                  <Marker
                    key={\`\${idx}\`}
                    position={[c.lat, c.lng]}
                    icon={createClusterIcon(c.count, getCategoryColor(c.category).color)}
                  >
                    <Popup minWidth={300} className="forensic-popup">
                      <IncidentPopup inc={c.incidents[0]} count={c.count} clusterIncidents={c.incidents} />
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-8 border-b border-slate-50 pb-3">Categorical Keys</h4>
              <div className="flex-1 space-y-10">
                {Object.entries(CRIME_TYPES).map(([k, g]) => (
                  <div key={k} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: g.color }} />
                      <span className="text-[10px] font-black text-slate-700 uppercase">{g.label}</span>
                    </div>
                    <div className="pl-6.5 space-y-1.5 opacity-60">
                      {g.items.map(it => <div key={it} className="text-[9px] font-bold text-slate-400 tracking-tight leading-tight uppercase tracking-widest">• {it}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* CRIME DASHBOARD LAYOUT */
        <div className="flex flex-col min-h-[850px] bg-slate-50 rounded-lg overflow-hidden border border-slate-200 animate-in fade-in duration-500">
           <div className="bg-white border-b border-slate-100 flex items-center justify-between px-6 py-4 shadow-sm z-10 w-full overflow-x-auto custom-scrollbar">
              <div className="text-[15px] font-extrabold text-slate-800 uppercase tracking-tight shrink-0 mr-8">Crime and Strategic Plans</div>
              <div className="flex items-center gap-6 shrink-0">
                <DashboardFilter label="Police District" value={filters.district} options={districts} onChange={v => setFilters({...filters, district: v})} />
                <DashboardFilter label="Police Beat" value={filters.beat} options={[]} onChange={v => setFilters({...filters, beat: v})} />
                <DashboardFilter label="Ward" value={filters.ward} options={[]} onChange={v => setFilters({...filters, ward: v})} />
                <DashboardFilter label="Community" value={filters.community} options={[]} onChange={v => setFilters({...filters, community: v})} />
                <DashboardFilter label="Crime Types" value={filters.crimeType} options={[]} onChange={v => setFilters({...filters, crimeType: v})} />
                <div className="flex flex-col min-w-[100px]">
                  <span className="text-[8px] text-slate-400 font-bold uppercase mb-1">Date</span>
                  <select value={filters.dateRange} onChange={e => setFilters({...filters, dateRange: e.target.value})} className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer">
                     <option value="Last 2 Weeks">Last 2 Weeks</option>
                     <option value="Last 30 Days">Last 30 Days</option>
                     <option value="Last 90 Days">Last 90 Days</option>
                     <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>
           </div>

           <div className="flex-1 grid grid-cols-12 overflow-hidden h-full">
              <div className="col-span-3 bg-white border-r border-slate-200 flex flex-col h-full z-10">
                 <div className="p-4 grid grid-cols-3 gap-1 border-b border-slate-50 shadow-sm">
                   <KPIBox label="Total Crime" val={kpis?.total} colorClass="text-blue-900" />
                   <KPIBox label="Violent Crime" val={kpis?.violent} colorClass="text-red-500" />
                   <KPIBox label="Property Crime" val={kpis?.property} colorClass="text-amber-500" />
                 </div>
                 <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#f8fafc]">
                    <div className="flex border-b border-slate-200 bg-slate-100 shrink-0">
                       {["Crime Incidents", "Strategic Plans"].map(sub => (
                          <div key={sub} onClick={() => setDashboardSubTab(sub)} className={\`flex-1 text-center py-2.5 text-[9px] font-black uppercase cursor-pointer transition-all border-b-2 \${dashboardSubTab === sub ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}\`}>{sub}</div>
                       ))}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                       {dashboardSubTab === "Crime Incidents" ? (
                         incidents.length > 0 ? incidents.slice(0, 50).map((inc, i) => <IncidentListItem key={i} inc={inc} active={selectedIncident?.id === inc.id} onClick={() => setSelectedIncident(inc)} />) : <div className="text-center py-10 text-[9px] font-black text-slate-400 uppercase">No recent crimes</div>
                       ) : (
                         <div className="flex flex-col items-center justify-center p-12 opacity-40 text-center"><Loader2 className="animate-spin text-blue-600 mb-2" size={18} /><span className="text-[9px] font-black text-slate-800 uppercase">Strategic Planning Module Offline</span></div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="col-span-9 flex flex-col relative bg-slate-50 shadow-inner h-full">
                 <div className="flex-1 relative overflow-hidden">
                   {dashboardMode === "Crime Statistics" ? (
                     <div className="h-full overflow-y-auto custom-scrollbar p-6 bg-[#f1f5f9]">
                        <CrimeDashboard
                          data={crimeTypeData}
                          highlights={kpis}
                          districtName={filters.district === "All" ? "Citywide" : districts.find(d => d.id === filters.district)?.name || "Selected District"}
                          beatRanking={beatRanking}
                          wardRanking={wardRanking}
                          hourlyData={hourlyData}
                          dowData={dowData}
                          trendData={trendSeries}
                        />
                     </div>
                   ) : (
                     <MapContainer center={selectedIncident ? [selectedIncident.lat, selectedIncident.lng] : [41.8781, -87.6298]} zoom={selectedIncident ? 16 : 11} className="h-full w-full z-0" zoomControl={true}>
                       <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                       <ZoomTracker setZoom={setZoom} />
                       <MapAutoScaler incidents={selectedIncident ? [selectedIncident] : incidents} />
                       {(!selectedIncident ? spatialClusters : [
                          { lat: selectedIncident.lat, lng: selectedIncident.lng, count: 1, category: selectedIncident.category, incidents: [selectedIncident] }
                       ]).map((c, idx) => (
                          <Marker
                            key={\`\${idx}\`}
                            position={[c.lat, c.lng]}
                            icon={createClusterIcon(c.count, getCategoryColor(c.category).color)}
                          >
                            <Popup minWidth={300} className="forensic-popup">
                              <IncidentPopup inc={c.incidents[0]} count={c.count} clusterIncidents={c.incidents} />
                            </Popup>
                          </Marker>
                        ))}
                       {selectedIncident && <><Circle center={[selectedIncident.lat, selectedIncident.lng]} radius={150} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.15, dashArray: '5,5' }} /><FindNearFlyTo lat={selectedIncident.lat} lng={selectedIncident.lng} /></>}
                     </MapContainer>
                   )}
                 </div>
                 <div className="h-12 bg-white border-t border-slate-200 flex flex-row items-center justify-center px-6 gap-8 shadow-sm shrink-0">
                    {["Crime Map", "Crime Statistics"].map(m => (
                      <div key={m} onClick={() => setDashboardMode(m)} className={\`text-[10px] font-black uppercase cursor-pointer py-2 border-b-2 transition-all \${dashboardMode === m ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent hover:text-slate-600"}\`}>{m}</div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
`

const lines = text.split('\n');
const head = lines.slice(0, 418).join('\n');
const tail = lines.slice(760).join('\n');

fs.writeFileSync(path, head + '\n' + newReturnBlock + '\n' + tail);
console.log("Success! Updated the block exactly from line index 418 to 760.");
