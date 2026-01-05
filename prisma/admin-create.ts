
import { prisma } from '../src/lib/prisma'
const readline = require('readline')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function question(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
    console.log('=== Create Admin User ===')

    try {
        const displayName = await question('Display Name: ')
        const email = await question('Email: ')
        const mobile = await question('Mobile (optional): ')

        if (!displayName || !email) {
            console.error('Error: Display Name and Email are required.')
            process.exit(1)
        }

        const user = await prisma.user.create({
            data: {
                displayName,
                email,
                mobile: mobile || null,
                permissions: ["user:account:create", "user:account:modify", "user:account:list", "team:create", "team:modify", "team:list", "ticket:properties:manage", "ticketstatus:view:any", "ticketpriority:view:any", "ticketcategory:view:any", "ticketcategory:create"], // Grant All Major User Level Permission
                Active: true
            }
        })

        console.log(`\nSuccess! Created admin user:`)
        console.log(`ID: ${user.id}`)
        console.log(`Name: ${user.displayName}`)
        console.log(`Email: ${user.email}`)
        console.log(`Permissions: ${JSON.stringify(user.permissions)}`)

    } catch (error) {
        console.error('\nError creating user:', error)
    } finally {
        rl.close()
        await prisma.$disconnect()
    }
}

main()
