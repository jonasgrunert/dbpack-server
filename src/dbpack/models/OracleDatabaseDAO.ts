import {Connection, getConnection} from "oracledb"
import {dbConfig} from "./../types"


export class OracleDatabaseDAO {
    private connection?: Connection
    private dbConfig: dbConfig
    public isValid: Boolean = false

    constructor (dbConfig: dbConfig){
        this.dbConfig = dbConfig
    }

    public async prepare(){
        this.connection = await getConnection({
            user: this.dbConfig.username,
            password: this.dbConfig.password,
            connectString: `${this.dbConfig.host}/${this.dbConfig.service}`
        })
        this.isValid = true
    }

}