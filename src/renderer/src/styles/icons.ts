import { IoMdPlay } from 'react-icons/io';
import { FiSave } from 'react-icons/fi';
import { FaDatabase, FaFileAlt, FaFolderPlus, FaPlus, FaRegSun } from 'react-icons/fa';
import { CgExport, CgTrash } from 'react-icons/cg';
import { BiListPlus } from 'react-icons/bi';
import { BsFileEarmarkPlayFill, BsFiletypeSql } from 'react-icons/bs';
import { makeIcon } from '@renderer/components/Icon';
import {
  MdOutlineChromeReaderMode,
  MdOutlineTextSnippet,
  MdPlaylistPlay,
  MdRefresh,
} from 'react-icons/md';

export const AddIcon = makeIcon(FaPlus, 20, 6);
export const AddSqlIcon = makeIcon(BsFiletypeSql);
export const SaveIcon = makeIcon(FiSave);
export const RemoveIcon = makeIcon(CgTrash);
export const RunFileIcon = makeIcon(BsFileEarmarkPlayFill);
export const RunIcon = makeIcon(IoMdPlay);
export const RunSelectionIcon = makeIcon(MdPlaylistPlay);
export const DuplicateIcon = makeIcon(BiListPlus);
export const ExportIcon = makeIcon(CgExport);
export const IconDatabase = makeIcon(FaDatabase);
export const IconSettings = makeIcon(FaRegSun);
export const IconFolder = makeIcon(FaFolderPlus);
export const IconFile = makeIcon(FaFileAlt);
export const PanelFile = makeIcon(MdOutlineChromeReaderMode);
export const IconFileWrited = makeIcon(MdOutlineTextSnippet);
export const IconRefresh = makeIcon(MdRefresh);
