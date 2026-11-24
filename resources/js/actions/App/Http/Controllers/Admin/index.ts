import ImpersonationController from './ImpersonationController'
import ActivityController from './ActivityController'
import ApiLogController from './ApiLogController'
import UserController from './UserController'
import TeamController from './TeamController'

const Admin = {
    ImpersonationController: Object.assign(ImpersonationController, ImpersonationController),
    ActivityController: Object.assign(ActivityController, ActivityController),
    ApiLogController: Object.assign(ApiLogController, ApiLogController),
    UserController: Object.assign(UserController, UserController),
    TeamController: Object.assign(TeamController, TeamController),
}

export default Admin