import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "renderer/components/maps-mangement-components/filter-panel.component";
import { MapItem, ParsedMapDiff } from "renderer/components/maps-mangement-components/map-item.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BSV_SORT_ORDER } from "renderer/partials/beat-saver/sort-order";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapCharacteristic, BsvMapDetail, MapFilter, SearchOrder, SearchParams } from "shared/models/maps/beat-saver.model";
import BeatWaitingImg from "../../../../../assets/images/apngs/beat-waiting.png";
import equal from "fast-deep-equal/es6";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export const DownloadMapsModal: ModalComponent<void, BSVersion> = ({data}) => {

    const beatSaver = BeatSaverService.getInstance();
    const mapsManager = MapsManagerService.getInstance();
    const mapsDownloader = MapsDownloaderService.getInstance();
    const progressBar = ProgressBarService.getInstance();

    const currentDownload = useObservable(mapsDownloader.currentMapDownload$);
    const mapsInQueue = useObservable(mapsDownloader.mapsInQueue$);
    const t = useTranslation();
    const [filter, setFilter] = useState<MapFilter>({});
    const [query, setQuery] = useState("");
    const [maps, setMaps] = useState<BsvMapDetail[]>([]);
    const [sortOrder, setSortOrder] = useState<SearchOrder>(BSV_SORT_ORDER.at(0));
    const [ownedMapHashs, setOwnedMapHashs] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useState<SearchParams>({
        sortOrder,
        filter,
        page: 0,
        q: query
    });

    const loaderRef = useRef(null);

    const sortOptions: BsmSelectOption[] = (() => {
        return BSV_SORT_ORDER.map(sort => ({text: `beat-saver.maps-sorts.${sort}`, value: sort}));
    })();
    
    useEffect(() => {
        loadMaps(searchParams);
    }, [searchParams]);
    

    useEffect(() => {
        mapsManager.getMaps(data, false).toPromise().then(maps => setOwnedMapHashs(maps.map(map => map.hash)));

        const onMapDownloaded = (map: BsvMapDetail, verion: BSVersion) => {
            if(!equal(verion, data) || !map?.versions){ return; }
            const downloadedHash = map.versions.at(0).hash;
            setOwnedMapHashs((prev) => [...prev, downloadedHash]);
        }
        mapsDownloader.addOnMapDownloadedListener(onMapDownloaded);

        if(mapsDownloader.isDownloading){
            progressBar.setStyle(mapsDownloader.progressBarStyle);
        }

        return () => {
            mapsDownloader.removeOnMapDownloadedListene(onMapDownloaded);
            progressBar.setStyle(null);
        }
    }, [])

    const loadMaps = (params: SearchParams) => {
        beatSaver.searchMaps(params).then((maps => setMaps(prev => [...prev, ...maps])));
    }

    const extractMapDiffs = (map: BsvMapDetail): Map<BsvMapCharacteristic, ParsedMapDiff[]> => {
        const res = new Map<BsvMapCharacteristic, ParsedMapDiff[]>();
        if(map.versions.at(0).diffs){
            map.versions.at(0).diffs.forEach(diff => {
                const arr = res.get(diff.characteristic) || [];
                arr.push({name: diff.difficulty, type: diff.difficulty, stars: diff.stars});
                res.set(diff.characteristic, arr);
            });
            
        }
        return res;
    }

    const renderMap = (map: BsvMapDetail) => {

        const isMapOwned = map.versions.some(version => ownedMapHashs.includes(version.hash));
        const isDownloading = map.id === currentDownload?.map?.id;
        const inQueue = mapsInQueue.some(toDownload => equal(toDownload.version, data) && toDownload.map.id === map.id);

        return (
            <MapItem
                autor={map.metadata.levelAuthorName}
                autorId={map.uploader.id}
                bpm={map.metadata.bpm}
                coverUrl={map.versions.at(0).coverURL}
                createdAt={map.createdAt}
                duration={map.metadata.duration}
                hash={map.versions.at(0).hash}
                likes={map.stats.upvotes}
                mapId={map.id}
                ranked={map.ranked}
                qualified={map.qualified}
                title={map.name}
                songAutor={map.metadata.songAuthorName}
                diffs={extractMapDiffs(map)}
                songUrl={map.versions.at(0).previewURL}
                key={map.id}
                onDownload={(!isMapOwned && !inQueue) && (handleDownloadMap)}
                onDoubleClick={(!isMapOwned && !inQueue) && (handleDownloadMap)}
                onCancelDownload={(inQueue && !isDownloading) && (handleCancelDownload)}
                downloading={isDownloading}
                callBackParam={map}
            />
        )
    }

    const handleDownloadMap = useCallback((map: BsvMapDetail) => {
        mapsDownloader.addMapToDownload({map, version: data})
    }, []);

    const handleCancelDownload = useCallback((map: BsvMapDetail) => {
        mapsDownloader.removeMapToDownload({map, version: data});
    }, []);

    const handleSortChange = (newSort: string) => {
        setSortOrder(() => newSort as SearchOrder);
        setMaps(() => []);
        setSearchParams(() => ({...searchParams, sortOrder: (newSort as SearchOrder)}));
    }

    const handleSearch = () => {
        const searchParams: SearchParams = {
            sortOrder,
            filter,
            q: query.trim(),
            page: 0,
        };

        setMaps(() => []);
        setSearchParams(() => searchParams);
    }

    const handleLoadMore = () => {
        setSearchParams((prev) => {
            return {...prev, page: prev.page + 1}
        });
    }

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col max-w-[95vw] w-[970px] h-[85vh] gap-3" onSubmit={e => {e.preventDefault(); handleSearch()}}>
            <div className="flex h-9 gap-2 shrink-0">
                <BsmDropdownButton className="shrink-0 h-full relative z-[1] flex justify-start" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1 !bg-main-color-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] bg-main-color-3 origin-top w-[450px] h-fit p-2 rounded-md shadow-md shadow-black" filter={filter} onChange={setFilter}/>
                </BsmDropdownButton>
                <input className="h-full bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" name="" id="" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={query} onChange={e => setQuery(e.target.value)}/>
                <BsmButton className="shrink-0 rounded-full py-1 px-3 !bg-main-color-1 flex justify-center items-center capitalize" icon="search" text="modals.download-maps.search-btn" withBar={false} onClick={e => {e.preventDefault(); handleSearch()}}/>
                <BsmSelect className="bg-main-color-1 rounded-full px-1 pb-0.5 text-center" options={sortOptions} onChange={handleSortChange}/>
            </div>
            <ul className="w-full grow flex content-start flex-wrap gap-2 px-2 overflow-y-scroll overflow-x-hidden scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900" >
                {maps.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <img className="w-32 h-32 spin-loading" src={BeatWaitingImg} alt=" "/>
                        <span className="text-lg">{t("modals.download-maps.loading-maps")}</span>
                    </div>
                ) : (
                    <>
                        {maps.map(renderMap)}
                        <motion.span onViewportEnter={handleLoadMore} ref={loaderRef} className="block w-full h-8"/>
                    </>
                )}
            </ul>
        </form>
    )
}