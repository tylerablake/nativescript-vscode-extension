import * as vscode from 'vscode';
import { GENERIC_AUTOCOMPLETE_DESCRIPTION } from './constants';

const DEFAULT_DOCUMENTATION = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);
const DEFAULT_COMMIT_CHARACTERS = ['='];

// Class to clean up creating new autocomplete keywords with default settings.
export class CompletionItem extends vscode.CompletionItem{
    constructor(label, commitCharacters, documentation){
        super(label);
        this.commitCharacters = commitCharacters;
        this.documentation = documentation;
    }
}

export const AUTOCAPITALIZATION = new CompletionItem('autocapitalizationType', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const KEYBOARD_TYPE = new CompletionItem('keyboardType', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const RETURN_KEY_TYPE = new CompletionItem('returnKeyType', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const TAB_BACKGROUND_COLOR = new CompletionItem('tabBackgroundColor', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const SELECTED_TAB_TEXT_COLOR = new CompletionItem('selectedTabTextColor', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const TAB_TEXT_COLOR = new CompletionItem('tabTextColor', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const ORIENTATION = new CompletionItem('orientation', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const FONT_STYLE = new CompletionItem('fontStyle', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const TEXT_ALIGNMENT = new CompletionItem('textAlignment', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const TEXT_DECORATION = new CompletionItem('textDecoration', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const TEXT_TRANSFORM = new CompletionItem('textTransform', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const VISIBILITY = new CompletionItem('visibility', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const VERTICAL_ALIGNMENT = new CompletionItem('verticalAlignment', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const HORIZONTAL_ALIGNMENT = new CompletionItem('horizontalAlignment', DEFAULT_COMMIT_CHARACTERS, DEFAULT_DOCUMENTATION);

export const COMPLETION_PROVIDER = vscode.languages.registerCompletionItemProvider('html', {

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {

        return [
            AUTOCAPITALIZATION,
            KEYBOARD_TYPE,
            RETURN_KEY_TYPE,
            TAB_BACKGROUND_COLOR,
            SELECTED_TAB_TEXT_COLOR,
            TAB_TEXT_COLOR,
            ORIENTATION,
            FONT_STYLE,
            TEXT_ALIGNMENT,
            TEXT_DECORATION,
            TEXT_TRANSFORM,
            VISIBILITY,
            VERTICAL_ALIGNMENT,
            HORIZONTAL_ALIGNMENT,
        ];

    },
});
