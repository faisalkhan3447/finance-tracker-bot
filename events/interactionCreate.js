import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage, formatUSD } from '../utils/currency.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';
import EmbedService from '../services/EmbedService.js';
import { generatePDFReceipt } from '../utils/pdf.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) { logger.error(`No command matching ${interaction.commandName} was found.`); return; }
      
      const allowedRolesStr = db.getConfig('allowed_roles');
      if (allowedRolesStr) {
        try {
          const allowedRoles = JSON.parse(allowedRolesStr);
          if (allowedRoles.length > 0) {
            const hasRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
            if (!hasRole && !interaction.member.permissions.has('Administrator')) {
              return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
          }
        } catch (e) { logger.error('Error parsing allowed roles:', e); }
      }
      
      try { await command.execute(interaction); } catch (error) {
        logger.error(`Error executing ${interaction.commandName}:`, error);
        const method = interaction.replied || interaction.deferred ? 'followUp' : 'reply';
        await interaction[method]({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    } else if (interaction.isButton()) {
      
      if (interaction.customId === 'stats_current_month') {
        const embed = EmbedService.generateMonthStatsEmbed(0);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (interaction.customId === 'stats_past_month') {
        const embed = EmbedService.generateMonthStatsEmbed(1);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const [action, ...txIdParts] = interaction.customId.split('_');
      const txId = txIdParts.join('_');
      
      if (action === 'undo') {
        try {
          await interaction.deferReply({ ephemeral: true });
          const tx = await TransactionService.deleteTransaction(txId, 'tx_id');
          const previousBalance = tx.balance_after + (tx.type === 'INCOME' ? -tx.amount : tx.amount);
          await NotificationService.dispatchAuditLog('UNDONE', tx, previousBalance);
          await NotificationService.refreshDashboard();
          await interaction.editReply(`✅ Successfully undone transaction **${txId}**.`);
        } catch (error) {
          logger.error(`Failed to undo tx ${txId}:`, error);
          await interaction.editReply(`❌ Failed to undo: ${error.message}`);
        }
      } else if (action === 'restore') {
         try {
          await interaction.deferReply({ ephemeral: true });
          const tx = await TransactionService.restoreTransaction(txId);
          const previousBalance = tx.balance_after - (tx.type === 'INCOME' ? tx.amount : -tx.amount);
          await NotificationService.dispatchAuditLog('RESTORED', tx, previousBalance);
          await NotificationService.refreshDashboard();
          await interaction.editReply(`✅ Successfully restored transaction **${txId}**.`);
        } catch (error) {
          logger.error(`Failed to restore tx ${txId}:`, error);
          await interaction.editReply(`❌ Failed to restore: ${error.message}`);
        }
      } else if (action === 'pdf') {
         try {
           await interaction.deferReply({ ephemeral: true });
           const tx = db.data.transactions.find(t => t.tx_id === txId);
           if (!tx) return interaction.editReply('Transaction not found.');
           
           const pdfBuffer = await generatePDFReceipt(tx);
           const attachment = new AttachmentBuilder(pdfBuffer, { name: `receipt_${tx.tx_id}.pdf` });
           
           const invoiceChannelId = db.getConfig('invoice_channel');
           if (invoiceChannelId) {
             const channel = await interaction.client.channels.fetch(invoiceChannelId).catch(() => null);
             if (channel) {
               await channel.send({ content: `🧾 Invoice generated for **${tx.tx_id}** by <@${interaction.user.id}>`, files: [attachment] });
               await interaction.editReply({ content: `✅ Invoice successfully sent to <#${invoiceChannelId}>!` });
               return;
             }
           }
           
           await interaction.editReply({ content: `Here is your receipt for **${tx.tx_id}**:`, files: [attachment] });
         } catch (error) {
           logger.error(`Failed to generate PDF for ${txId}:`, error);
           await interaction.editReply('Failed to generate PDF. Make sure pdfkit is installed.');
         }
      }
    }
  }
};