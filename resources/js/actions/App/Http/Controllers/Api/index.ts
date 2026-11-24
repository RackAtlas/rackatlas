import AgentIngestController from './AgentIngestController'
import TerminalBridgeController from './TerminalBridgeController'
import BackupWebhookController from './BackupWebhookController'
import V1 from './V1'

const Api = {
    AgentIngestController: Object.assign(AgentIngestController, AgentIngestController),
    TerminalBridgeController: Object.assign(TerminalBridgeController, TerminalBridgeController),
    BackupWebhookController: Object.assign(BackupWebhookController, BackupWebhookController),
    V1: Object.assign(V1, V1),
}

export default Api