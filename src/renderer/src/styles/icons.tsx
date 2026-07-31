import React from 'react';

import IconMdiFileDocumentOutline from '~icons/mdi/file-document-outline';
import IconMdiPlaylistPlay from '~icons/mdi/playlist-play';
import IconMdiBookOpenOutline from '~icons/mdi/book-open-outline';
import IconMdiCloseCircleOutline from '~icons/mdi/close-circle-outline';
import IconMdiRefresh from '~icons/mdi/refresh';
import IconMdiCounter from '~icons/mdi/counter';
import IconMdiRecordCircleOutline from '~icons/mdi/record-circle-outline';
import IconFaSolidPlus from '~icons/fa-solid/plus';
import IconFaSolidCog from '~icons/fa-solid/cog';
import IconFaSolidFolder from '~icons/fa-solid/folder';
import IconFaSolidFolderPlus from '~icons/fa-solid/folder-plus';
import IconFaSolidDatabase from '~icons/fa-solid/database';
import IconFaSolidFileAlt from '~icons/fa-solid/file-alt';
import IconFeatherSave from '~icons/feather/save';
import IconBiFiletypeSql from '~icons/bi/filetype-sql';
import IconBiFileEarmarkPlayFill from '~icons/bi/file-earmark-play-fill';
import IconGgTrash from '~icons/gg/trash';
import IconGgExport from '~icons/gg/export';
import IconMdiImport from '~icons/mdi/import';
import IconMdiHistory from '~icons/mdi/history';
import IconBxListPlus from '~icons/bx/list-plus';
import IconIonMdPlay from '~icons/ion/md-play';

function makeIconWithSize(
  Icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>,
  size = 20,
) {
  return (props: React.SVGProps<SVGSVGElement> & { title?: string; size?: number }) => (
    <Icon
      {...props}
      width={props?.width ?? props?.size ?? size}
      height={props?.height ?? props?.size ?? size}
    />
  );
}

export const AddIcon = makeIconWithSize(IconFaSolidPlus);
export const CancelIcon = makeIconWithSize(IconMdiCloseCircleOutline);
export const CountIcon = makeIconWithSize(IconMdiCounter);
export const FileSqlIcon = makeIconWithSize(IconBiFiletypeSql);
export const SaveIcon = makeIconWithSize(IconFeatherSave);
export const RemoveIcon = makeIconWithSize(IconGgTrash);
export const RunFileIcon = makeIconWithSize(IconBiFileEarmarkPlayFill);
export const RunIcon = makeIconWithSize(IconIonMdPlay);
export const RunSelectionIcon = makeIconWithSize(IconMdiPlaylistPlay);
export const DuplicateIcon = makeIconWithSize(IconBxListPlus);
export const ExportIcon = makeIconWithSize(IconGgExport);
export const ImportIcon = makeIconWithSize(IconMdiImport);
export const HistoryIcon = makeIconWithSize(IconMdiHistory);
export const RecordIcon = makeIconWithSize(IconMdiRecordCircleOutline);
export const IconDatabase = makeIconWithSize(IconFaSolidDatabase);
export const IconSettings = makeIconWithSize(IconFaSolidCog);
export const IconFolder = makeIconWithSize(IconFaSolidFolder);
export const IconFolderAdd = makeIconWithSize(IconFaSolidFolderPlus);
export const IconFile = makeIconWithSize(IconFaSolidFileAlt);
export const PanelFile = makeIconWithSize(IconMdiBookOpenOutline);
export const IconFileWrited = makeIconWithSize(IconMdiFileDocumentOutline);
export const IconRefresh = makeIconWithSize(IconMdiRefresh);
