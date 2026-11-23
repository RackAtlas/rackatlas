import TerminalController from './TerminalController'
import TerminalSessionController from './TerminalSessionController'
import TerminalSnippetController from './TerminalSnippetController'

const Terminal = {
    TerminalController: Object.assign(TerminalController, TerminalController),
    TerminalSessionController: Object.assign(TerminalSessionController, TerminalSessionController),
    TerminalSnippetController: Object.assign(TerminalSnippetController, TerminalSnippetController),
}

export default Terminal