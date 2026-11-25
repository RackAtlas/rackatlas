import Api from './Api'
import HomeController from './HomeController'
import PrivacyController from './PrivacyController'
import DemoController from './DemoController'
import ApiDocsController from './ApiDocsController'
import FeedbackController from './FeedbackController'
import CrawlerController from './CrawlerController'
import Settings from './Settings'
import DashboardController from './DashboardController'
import CurrentTeamController from './CurrentTeamController'
import AppFeedbackController from './AppFeedbackController'
import Servers from './Servers'
import DatabaseController from './DatabaseController'
import DatabaseProcessController from './DatabaseProcessController'
import RedisController from './RedisController'
import Terminal from './Terminal'
import ApplicationController from './ApplicationController'
import DockerController from './DockerController'
import FirewallController from './FirewallController'
import FileManagerController from './FileManagerController'
import CronController from './CronController'
import UpdateController from './UpdateController'
import MetricsController from './MetricsController'
import MetricsProcessesController from './MetricsProcessesController'
import NetworkController from './NetworkController'
import BackupController from './BackupController'
import DocumentController from './DocumentController'
import Admin from './Admin'

const Controllers = {
    Api: Object.assign(Api, Api),
    HomeController: Object.assign(HomeController, HomeController),
    PrivacyController: Object.assign(PrivacyController, PrivacyController),
    DemoController: Object.assign(DemoController, DemoController),
    ApiDocsController: Object.assign(ApiDocsController, ApiDocsController),
    FeedbackController: Object.assign(FeedbackController, FeedbackController),
    CrawlerController: Object.assign(CrawlerController, CrawlerController),
    Settings: Object.assign(Settings, Settings),
    DashboardController: Object.assign(DashboardController, DashboardController),
    CurrentTeamController: Object.assign(CurrentTeamController, CurrentTeamController),
    AppFeedbackController: Object.assign(AppFeedbackController, AppFeedbackController),
    Servers: Object.assign(Servers, Servers),
    DatabaseController: Object.assign(DatabaseController, DatabaseController),
    DatabaseProcessController: Object.assign(DatabaseProcessController, DatabaseProcessController),
    RedisController: Object.assign(RedisController, RedisController),
    Terminal: Object.assign(Terminal, Terminal),
    ApplicationController: Object.assign(ApplicationController, ApplicationController),
    DockerController: Object.assign(DockerController, DockerController),
    FirewallController: Object.assign(FirewallController, FirewallController),
    FileManagerController: Object.assign(FileManagerController, FileManagerController),
    CronController: Object.assign(CronController, CronController),
    UpdateController: Object.assign(UpdateController, UpdateController),
    MetricsController: Object.assign(MetricsController, MetricsController),
    MetricsProcessesController: Object.assign(MetricsProcessesController, MetricsProcessesController),
    NetworkController: Object.assign(NetworkController, NetworkController),
    BackupController: Object.assign(BackupController, BackupController),
    DocumentController: Object.assign(DocumentController, DocumentController),
    Admin: Object.assign(Admin, Admin),
}

export default Controllers