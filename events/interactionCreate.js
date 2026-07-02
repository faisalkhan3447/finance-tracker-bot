import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing ${interaction.commandName}:`, error);
        const replyPayload = { content: 'There was an error while executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload);
        } else {
          await interaction.reply(replyPayload);
        }
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
    // Note: ModalSubmit and StringSelectMenu handling for setup will go here if needed.
  }
};

/**
 * Handles interactions originating from buttons on the Audit Logs.
 */
async function handleButtonInteraction(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('view_')) {
    const txId = customId.split('_')[1];
    const tx = db.prepare('SELECT * FROM transactions WHERE tx_id = ?').get(txId);
    
    if (!tx) {
      return interaction.reply({ content: 'Transaction not found.', ephemeral: true });
    }
    
    const status = tx.is_deleted ? 'DELETED' : 'ACTIVE';
    return interaction.reply({
      content: `**Transaction ${txId}**\nReason: ${tx.reason}\nStatus: ${status}`,
      ephemeral: true
    });
  }

  // Admin checks for Undo/Restore
  const isAdmin = interaction.member.permissions.has('Administrator');
  if (!isAdmin) {
    return interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
  }

  try {
    if (customId.startsWith('undo_')) {
      await interaction.deferReply({ ephemeral: true });
      const txId = customId.split('_')[1];
      
      const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
      const deletedTx = await TransactionService.deleteTransaction(txId, 'tx_id');
      
      await NotificationService.dispatchAuditLog('UNDONE', deletedTx, oldBalance);
      await NotificationService.refreshDashboard();
      
      await interaction.editReply({ content: `✅ Transaction **${txId}** has been undone.` });
      
    } else if (customId.startsWith('restore_')) {
      await interaction.deferReply({ ephemeral: true });
      const txId = customId.split('_')[1];
      
      const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
      const restoredTx = await TransactionService.restoreTransaction(txId);
      
      await NotificationService.dispatchAuditLog('RESTORED', restoredTx, oldBalance);
      await NotificationService.refreshDashboard();
      
      await interaction.editReply({ content: `✅ Transaction **${txId}** has been restored.` });
    }
  } catch (error) {
    logger.error('Error handling button interaction:', error);
    const replyMethod = interaction.deferred ? 'editReply' : 'reply';
    await interaction[replyMethod]({ content: `❌ Action failed: ${error.message}`, ephemeral: true });
  }
}