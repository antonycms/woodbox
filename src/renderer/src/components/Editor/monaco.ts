import * as monaco from 'monaco-editor/editor/editor.api';

import 'monaco-editor/languages/definitions/sql/register';
import 'monaco-editor/languages/features/json/register';

import 'monaco-editor/editor/common/services/treeViewsDndService';
import 'monaco-editor/editor/contrib/codelens/browser/codeLensCache';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching';
import 'monaco-editor/editor/contrib/find/browser/findController';
import 'monaco-editor/editor/contrib/folding/browser/folding';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController';
import 'monaco-editor/editor/contrib/tokenization/browser/tokenization';

export * from 'monaco-editor/editor/editor.api';
export default monaco;
