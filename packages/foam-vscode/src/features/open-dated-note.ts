import {
  workspace,
  ExtensionContext,
  commands,
  languages,
  CompletionItemProvider,
  CompletionItem,
  CompletionItemKind,
  CompletionList
} from "vscode";
import { getDailyNoteFileName, openDailyNoteFor } from "../dated-notes";
import { LinkReferenceDefinitionsSetting } from "../settings";
import { FoamFeature } from "../types";

interface DateSnippet {
  snippet: string;
  date: Date;
  detail: string;
}

const daysOfWeek = [
  { day: "sunday", index: 0 },
  { day: "monday", index: 1 },
  { day: "tuesday", index: 2 },
  { day: "wednesday", index: 3 },
  { day: "thursday", index: 4 },
  { day: "friday", index: 5 },
  { day: "saturday", index: 6 }
];

const foamConfig = workspace.getConfiguration("foam");
const foamExtension = foamConfig.get("openDailyNote.fileExtension");
const foamLinkReferenceDefinitions = foamConfig.get(
  "edit.linkReferenceDefinitions"
);
const foamNavigateOnSelect = foamConfig.get("snippets.navigateOnSelect");

const generateDayOfWeekSnippets = (): DateSnippet[] => {
  const getTarget = (day: number) => {
    const target = new Date();
    const currentDay = target.getDay();
    const distance = (day + 7 - currentDay) % 7;
    target.setDate(target.getDate() + distance);
    return target;
  };
  const snippets = daysOfWeek.map(({ day, index }) => {
    const target = getTarget(index);
    return {
      date: target,
      detail: `Get a daily note link for ${day}`,
      snippet: `/${day}`
    };
  });
  return snippets;
};

const createCompletionItem = ({ snippet, date, detail }: DateSnippet) => {
  const completionItem = new CompletionItem(
    snippet,
    CompletionItemKind.Snippet
  );
  completionItem.insertText = getDailyNoteLink(date);
  completionItem.detail = `${completionItem.insertText} - ${detail}`;
  if (foamNavigateOnSelect) {
    completionItem.command = {
      command: "foam-vscode.open-dated-note",
      title: "Open a note for the given date",
      arguments: [date]
    };
  }
  return completionItem;
};

const getDailyNoteLink = (date: Date) => {
  let name = getDailyNoteFileName(foamConfig, date);
  if (
    foamLinkReferenceDefinitions ===
    LinkReferenceDefinitionsSetting.withoutExtensions
  ) {
    name = name.replace(`.${foamExtension}`, "");
  }
  return `[[${name}]]`;
};

const snippets: (() => DateSnippet)[] = [
  () => ({
    detail: "Insert a link to today's daily note",
    snippet: "/day",
    date: new Date()
  }),
  () => ({
    detail: "Insert a link to today's daily note",
    snippet: "/today",
    date: new Date()
  }),
  () => {
    const today = new Date();
    return {
      detail: "Insert a link to tomorrow's daily note",
      snippet: "/tomorrow",
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    };
  },
  () => {
    const today = new Date();
    return {
      detail: "Insert a link to yesterday's daily note",
      snippet: "/yesterday",
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    };
  }
];

const computedSnippets: ((number: number) => DateSnippet)[] = [
  (days: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${days} day(s) from now`,
      snippet: `/+${days}d`,
      date: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + days
      )
    };
  },
  (weeks: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${weeks} week(s) from now`,
      snippet: `/+${weeks}w`,
      date: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 7 * weeks
      )
    };
  },
  (months: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${months} month(s) from now`,
      snippet: `/+${months}m`,
      date: new Date(
        today.getFullYear(),
        today.getMonth() + months,
        today.getDate()
      )
    };
  },
  (years: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${years} year(s) from now`,
      snippet: `/+${years}y`,
      date: new Date(
        today.getFullYear() + years,
        today.getMonth(),
        today.getDate()
      )
    };
  }
];

const completions: CompletionItemProvider = {
  provideCompletionItems: (_document, _position, _token, _context) => {
    const completionItems = [
      ...snippets.map(item => createCompletionItem(item())),
      ...generateDayOfWeekSnippets().map(item => createCompletionItem(item))
    ];
    return completionItems;
  }
};

const computedCompletions: CompletionItemProvider = {
  provideCompletionItems: (document, position, _token, _context) => {
    const range = document.getWordRangeAtPosition(position, /\S+/);
    const snippetString = document.getText(range);
    const matches = snippetString.match(/(\d+)/);
    const number: string = matches ? matches[0] : "1";
    const completionItems = computedSnippets.map(item => {
      const completionItem = createCompletionItem(item(parseInt(number)));
      completionItem.range = range;
      return completionItem;
    });
    // We still want the list to be treated as "incomplete", because the user may add another number
    return new CompletionList(completionItems, true);
  }
};

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-dated-note", date =>
        openDailyNoteFor(date)
      )
    );
    languages.registerCompletionItemProvider("markdown", completions, "/");
    languages.registerCompletionItemProvider(
      "markdown",
      computedCompletions,
      "/",
      "+"
    );
  }
};

export default feature;
